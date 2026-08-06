// Bills usa un único schema PostgreSQL en todos los entornos. Generar el cliente
// no abre una conexión, por lo que postinstall también funciona sin DATABASE_URL.

import { execSync } from "node:child_process";

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit" });
}

run("prisma generate");
