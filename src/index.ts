import { mkdirSync, writeFile } from "fs";
import { JSDOM } from "jsdom";
import { promisify } from "util";
import { RequestManager } from "./RequestManager";

const { version } = require("../package.json");

const writeFileAsync = promisify(writeFile);

const requestManager = new RequestManager({ headers: { Authorization: "Token " + process.argv[3] } });

const extRegExp = /\.\w{2,4}$/i,
	urlRegExp = /(https?:\/\/)?([\w\d-.]{2,})(?:\/([^/\s]+))?/i;

function createDir(path: string): boolean {
	try {
		mkdirSync(path, { recursive: true });
	} catch (error) {
		if (error.code != "EEXIST") throw error;
		else return false;
	}

	return true;
}

async function dump(from: string, to: string): Promise<string> {
	try {
		const r = await requestManager.push<string>(from);
		let outPath = to;
		
		if (!extRegExp.test(from)) {
			createDir(outPath);
			outPath += "/index.html";
		} else {
			createDir(outPath.split("/").slice(0, -1).join("/"));
		}

		await writeFileAsync(outPath, r.data);
		console.log(` - Successfully dumped '${from}' to '${outPath}'`);
		return r.data;
	} catch (e) {
		console.error(` - Failed to dump '${from}': ${e.stack ?? e.toString()}`);
		throw e;
	}
}

async function dumpStatic(protocol: string, site: string, dumpDir: string, doc: Document): Promise<number> {
	const staticAssets = Array.from(doc.querySelectorAll<HTMLLinkElement | HTMLScriptElement>("link, script"))
		.map((el) => {
			if ("href" in el) return el.href;
			else if ("src" in el) return el.src;
			else return undefined;
		})
		.filter((link) => link != undefined && link != "") as string[];

	console.log(`\nDumping ${staticAssets.length} static asset(s)...`);
	await Promise.all(staticAssets.map((path) => dump(`${protocol}${site}${path}`, `${dumpDir}${path}`)));

	return staticAssets.length;
}

async function dumpTournament(dumpDir: string, protocol: string, site: string, tournament: string, includeStatic?: boolean): Promise<void> {
	const start = Date.now();
	let totalPages = 1;

	console.log(`\n= ${tournament} on ${site} =`);

	console.log("\nDumping index page...");
	const indexData = await dump(`${protocol}${site}/${tournament}`, `${dumpDir}/${tournament}`),
		indexDoc = new JSDOM(indexData).window.document,
		corePages = Array.from(indexDoc.querySelectorAll<HTMLAnchorElement>("ul.navbar-nav a"))
			.filter((el) => !el.href.startsWith("about:blank") && !el.href.startsWith("/accounts"))
			.map((el) => el.href);

	if (includeStatic) totalPages += await dumpStatic(protocol, site, dumpDir, indexDoc);

	let participantLinks: string[] | undefined;
	
	console.log(`\nDumping ${corePages.length} core page(s)...`);
	await Promise.all(corePages.map(async (link) => {
			const data = await dump(`${protocol}${site}${link}`, `${dumpDir}${link}`);

			if (!participantLinks && (link.endsWith("/participants/list/") || link.endsWith("/feedback/progress/"))) {
				const doc = new JSDOM(data).window.document,
					dataScript = Array.from(doc.querySelectorAll("script")).find((el) => el.innerHTML.includes("vueData"));

				if (dataScript) {
					const dataResult = /(\[.*\])/.exec(dataScript.innerHTML);

					if (dataResult) {
						const tableData = JSON.parse(dataResult[0]),
							links: string[] = [];

						tableData.forEach((table: any) => {
							table.data.forEach((row: any[]) => {
								let link: string | undefined;

								row.forEach((cell) => {
									if (cell.popover) {
										const linkLine = cell.popover.content.find((line: any) => "link" in line);
										if (linkLine) link = linkLine.link;
									}
								});

								if (link) links.push(link);
							});
						});

						participantLinks = links.filter((link, i) => links.indexOf(link) == i);
					}
				}
			}
		}));

	totalPages += corePages.length;

	if (participantLinks) {
		console.log(`\nDumping ${participantLinks.length} participant record page(s)...`);
		await Promise.all(participantLinks.map((link) => dump(`${protocol}${site}${link}`, `${dumpDir}${link}`)));
		totalPages += participantLinks.length;
	} else console.log("Unable to find participant record pages, make sure the participant list or feedback progress page is enabled.");

	console.log(`\nSuccessfully dumped ${totalPages} page(s) from tournament '${tournament}' on site '${protocol}${site}' to '${dumpDir}' in ${Date.now() - start}ms.`);
}

function exit(reason: string | Error): void {
	if (reason instanceof Error) reason = reason.stack ?? reason.toString();
	console.error(`${reason}`);
	process.exit(1);
}

async function main(): Promise<void> {
	console.log(`tabbydump v${version} - https://github.com/CreatedBySeb/tabbydump`);

	try {
		createDir(`${process.cwd()}/dumps`);
	} catch (error) {
		exit(error);
	}

	let url = process.argv[2];

	if (!url) return exit("No URL specified.");

	const urlResult = urlRegExp.exec(url);

	if (!urlResult) return exit("Invalid URL specified.");
	if (!urlResult[1]) urlResult[1] = "http://";

	const [protocol, host, tournament] = urlResult.slice(1);

	const dumpDir = `${process.cwd()}/dumps/${host}`;

	createDir(dumpDir);

	if (tournament) await dumpTournament(dumpDir, protocol, host, tournament, true);
	else {
		console.log(`No tournament in URL, dumping all active tournaments...`);

		console.log("\nDumping site home page...");

		const indexData = await dump(`${protocol}${host}`, dumpDir + "/index.html"),
			indexDoc = new JSDOM(indexData).window.document,
			activeTournaments = Array.from(indexDoc.querySelectorAll<HTMLAnchorElement>(".list-group.mt-2 a"))
				.slice(0, -1)
				.map((el) => el.href.slice(1, -1));

		if (activeTournaments.indexOf("inactive") > -1) {
			console.log("Inactive tournaments are present, these will not be dumped.");
			activeTournaments.splice(activeTournaments.indexOf("inactive"), 1);
		}

		await dumpStatic(protocol, host, dumpDir, indexDoc);

		for (let i = 0; i < activeTournaments.length; i++) {
			await dumpTournament(dumpDir, protocol, host, activeTournaments[i]);
		}

		console.log(`\nSuccessfully dumped ${activeTournaments.length} tournament(s).`);
	}
}

main();