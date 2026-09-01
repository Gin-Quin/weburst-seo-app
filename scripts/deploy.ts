import { $ } from "bun";

const bunVersion = "1.4.0";
const serviceName = "my-bun-app";
const releasesDirectory = "/root/weburst-releases";
const releaseId = new Date().toISOString().replaceAll(/[:.]/g, "-");
const releaseDirectory = `${releasesDirectory}/${releaseId}`;
const appPath = "/root/app";
const nextAppPath = "/root/app-next";

const deployedBunVersion = (await $`ssh weburst /root/.bun/bin/bun --version`.text()).trim();
if (deployedBunVersion !== bunVersion) {
	console.log(`Installing Bun ${bunVersion} (currently ${deployedBunVersion})...`);
	await $`ssh weburst curl -fsSL https://bun.com/install -o /tmp/install-bun.sh`;
	await $`ssh weburst bash /tmp/install-bun.sh bun-v${bunVersion}`;
}

const mainPid = (
	await $`ssh weburst systemctl show ${serviceName} --property MainPID --value`.text()
).trim();
const bunPids = (await $`ssh weburst ps -C bun -o pid=`.text())
	.split("\n")
	.map((value) => value.trim())
	.filter(Boolean);
const unexpectedBunPids = bunPids.filter((pid) => pid !== mainPid);
if (unexpectedBunPids.length > 0) {
	throw new Error(
		`Refusing to deploy while unmanaged Bun processes are running: ${unexpectedBunPids.join(", ")}`,
	);
}

console.log(`Uploading release ${releaseId}...`);
await $`ssh weburst mkdir -p ${releaseDirectory}`;
await $`rsync -avz --delete -e ssh ./build/ weburst:${releaseDirectory}/`;
await $`rsync -avz -e ssh .env.prod weburst:${releaseDirectory}/.env`;
await $`rsync -avz -e ssh deployment/my-bun-app.service weburst:/etc/systemd/system/my-bun-app.service`;

const appIsSymlink = (await $`ssh weburst test -L ${appPath}`.nothrow()).exitCode === 0;
let previousRelease: string;

if (appIsSymlink) {
	previousRelease = (await $`ssh weburst readlink -f ${appPath}`.text()).trim();
} else {
	previousRelease = `/root/app-legacy-${releaseId}`;
	console.log("Migrating the existing deployment to atomic releases...");
	await $`ssh weburst systemctl stop ${serviceName}`;
	await $`ssh weburst mv ${appPath} ${previousRelease}`;
}

const activateRelease = async (target: string) => {
	await $`ssh weburst ln -sfn ${target} ${nextAppPath}`;
	await $`ssh weburst mv -Tf ${nextAppPath} ${appPath}`;
};

try {
	await activateRelease(releaseDirectory);
	await $`ssh weburst systemctl daemon-reload`;
	await $`ssh weburst systemctl restart ${serviceName}`;

	const healthcheck =
		await $`ssh weburst curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-connrefused http://127.0.0.1:3000/api/keywords/callback`.nothrow();
	if (healthcheck.exitCode !== 0) {
		throw new Error("Production health check failed after restart");
	}
} catch (error) {
	console.error(`Deployment failed; rolling back to ${previousRelease}`);
	await activateRelease(previousRelease);
	await $`ssh weburst systemctl daemon-reload`.nothrow();
	await $`ssh weburst systemctl restart ${serviceName}`.nothrow();
	throw error;
}

console.log(`🚀 Release ${releaseId} deployed successfully!`);
