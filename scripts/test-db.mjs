#!/usr/bin/env node
// Por que este script existe: o repo vive em E:\, um drive removível FAT32.
// O backend WSL2 do Docker Desktop compartilha esse drive com os containers
// via /mnt/host/e, mas esse bridge não reflete o conteúdo atual do drive —
// `wsl -d docker-desktop -- ls /mnt/host/e/.../supabase/tests/database` mostra
// o diretório vazio mesmo com arquivos recém-gravados. Por isso `supabase test
// db` (que depende desse bind mount para o container do pg_prove) sempre
// reporta "Files=0, Tests=0 / no pgTAP tests found", mesmo com testes válidos
// em supabase/tests/database. `docker cp` (uma cópia via stream) não usa esse
// bridge e funciona normalmente, então este script copia os arquivos de teste
// para dentro do container do Postgres e roda cada um com `psql` diretamente,
// reproduzindo o mesmo resultado que `pg_prove` daria.
//
// Se o repo for movido para um drive NTFS fixo, `npm run test:db` pode voltar
// a ser `supabase test db` — este script deixa de ser necessário.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "supabase", "config.toml");
const testsDir = path.join(repoRoot, "supabase", "tests", "database");
const containerTestsDir = "/tmp/pgtap";

function getProjectId() {
  const config = readFileSync(configPath, "utf8");
  const match = config.match(/^project_id\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error(`project_id não encontrado em ${configPath}`);
  }
  return match[1];
}

// Roda um comando docker que é pré-requisito (preparar/copiar arquivos no
// container). Se falhar, o problema quase sempre é "o container não existe
// ou não está rodando" — imprime uma mensagem curta em português e sai,
// sem stack trace do Node.
function runDockerOrDie(args, container) {
  try {
    return execFileSync("docker", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = (error.stderr || error.message || "").toString().trim();
    console.error(
      `Não foi possível acessar o container ${container}. O Supabase local está rodando? Rode: npm run db:start`,
    );
    if (detail) console.error(detail);
    process.exit(1);
  }
}

function main() {
  const projectId = getProjectId();
  const container = `supabase_db_${projectId}`;

  // Limpa e recria o diretório de testes dentro do container.
  runDockerOrDie(
    [
      "exec",
      container,
      "sh",
      "-c",
      `rm -rf ${containerTestsDir} && mkdir -p ${containerTestsDir}`,
    ],
    container,
  );

  // Copia o conteúdo de supabase/tests/database/ para dentro do container.
  runDockerOrDie(
    ["cp", `${testsDir}/.`, `${container}:${containerTestsDir}/`],
    container,
  );

  const files = readdirSync(testsDir)
    .filter((f) => f.endsWith(".test.sql"))
    .sort();

  if (files.length === 0) {
    console.error(
      `FALHA: nenhum arquivo *.test.sql encontrado em ${testsDir}. Sem testes, o banco não foi verificado.`,
    );
    process.exit(1);
  }

  let totalOk = 0;
  let totalNotOk = 0;
  let totalPlanned = 0;
  let anyFailure = false;

  for (const file of files) {
    console.log(`\n--- ${file} ---`);
    const containerPath = `${containerTestsDir}/${file}`;
    let stdout = "";
    let stderr = "";
    let failed = false;

    try {
      stdout = execFileSync(
        "docker",
        [
          "exec",
          container,
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-X",
          "-q",
          "-f",
          containerPath,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      failed = true;
      stdout = error.stdout ?? "";
      stderr = error.stderr ?? "";
    }

    if (stdout) console.log(stdout.trimEnd());
    if (stderr) console.error(stderr.trimEnd());

    const lines = stdout.split("\n").map((l) => l.trim());
    const okCount = lines.filter((l) => /^ok\b/.test(l)).length;
    const notOkCount = lines.filter((l) => /^not ok\b/.test(l)).length;
    const ranCount = okCount + notOkCount;
    const planLine = lines.find((l) => /^1\.\.(\d+)$/.test(l));
    const planned = planLine ? Number(planLine.match(/^1\.\.(\d+)$/)[1]) : null;
    const sawLooksLikeYou = lines.some((l) => l.includes("# Looks like you"));

    totalOk += okCount;
    totalNotOk += notOkCount;
    if (planned !== null) totalPlanned += planned;

    if (failed) {
      console.error(`FALHA: psql saiu com erro ao rodar ${file}`);
      anyFailure = true;
    }
    if (notOkCount > 0) {
      anyFailure = true;
    }
    if (okCount === 0 && notOkCount === 0) {
      console.error(`FALHA: ${file} não imprimiu nenhuma linha "ok"`);
      anyFailure = true;
    }
    if (planned === null) {
      console.error(
        `FALHA: ${file} não imprimiu a linha do plano (ex: "1..17")`,
      );
      anyFailure = true;
    } else if (ranCount !== planned) {
      console.error(
        `FALHA: ${file} planejou ${planned} teste(s) mas rodou ${ranCount} (${okCount} ok, ${notOkCount} not ok) — provavelmente parou antes do fim`,
      );
      anyFailure = true;
    }
    if (sawLooksLikeYou) {
      anyFailure = true;
    }

    console.log(
      `${file}: planejado ${planned ?? "?"}, rodado ${ranCount} (${okCount} ok, ${notOkCount} not ok)`,
    );
  }

  console.log(
    `\npgTAP: ${files.length} arquivo(s), ${totalOk} ok, ${totalNotOk} not ok, ${totalPlanned} planejado(s)`,
  );

  process.exit(anyFailure ? 1 : 0);
}

main();
