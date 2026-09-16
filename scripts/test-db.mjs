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

function runDocker(args) {
  return execFileSync("docker", args, { encoding: "utf8" });
}

function main() {
  const projectId = getProjectId();
  const container = `supabase_db_${projectId}`;

  // Limpa e recria o diretório de testes dentro do container.
  runDocker([
    "exec",
    container,
    "sh",
    "-c",
    `rm -rf ${containerTestsDir} && mkdir -p ${containerTestsDir}`,
  ]);

  // Copia o conteúdo de supabase/tests/database/ para dentro do container.
  runDocker(["cp", `${testsDir}/.`, `${container}:${containerTestsDir}/`]);

  const files = readdirSync(testsDir)
    .filter((f) => f.endsWith(".test.sql"))
    .sort();

  let totalOk = 0;
  let totalNotOk = 0;
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
        { encoding: "utf8" },
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

    totalOk += okCount;
    totalNotOk += notOkCount;

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
  }

  console.log(
    `\npgTAP: ${files.length} arquivo(s), ${totalOk} ok, ${totalNotOk} not ok`,
  );

  process.exit(anyFailure ? 1 : 0);
}

main();
