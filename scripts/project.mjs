import { readFileSync, writeFileSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export function loadProject() {
    return new Project();
}

class Project {
    #dir;

    constructor() {
        this.#dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

        const rootPkg = JSON.parse(readFileSync(path.join(this.#dir, "package.json"), "utf8"));
        if (!rootPkg.workspaces?.length) {
            throw new Error("No workspaces found in root package.json");
        }
        this._workspaces = rootPkg.workspaces.map((d) => new Workspace(this, d));
        this._rootPkg = rootPkg;
    }

    workspace(dir) {
        const ws = this._workspaces.find((w) => w.dir === dir);
        if (!ws) {
            throw new Error(`Unknown workspace "${dir}"`);
        }
        return ws;
    }

    *workspaces() {
        yield* this._workspaces;
    }

    build() {
        this.npm(["run", "build"], this.#dir);
    }

    test() {
        this.npm(["test"], this.#dir);
    }

    stageAll() {
        this.npm(["run", "dist"], this.#dir);
    }

    async clean() {
        for (const ws of this._workspaces) {
            await ws.clean();
        }
    }

    setVersion(version) {
        this._rootPkg.version = version;
        writeFileSync(path.join(this.#dir, "package.json"), `${JSON.stringify(this._rootPkg, null, 4)}\n`, "utf8");
    }

    assertClean() {
        const status = execFileSync("git", ["status", "--porcelain"], {
            cwd: this.#dir,
            encoding: "utf8",
        }).trim();

        if (status.length > 0) {
            throw new Error("Working tree must be clean before preparing a release.");
        }
    }

    /** @internal */
    path(...segments) {
        return path.join(this.#dir, ...segments);
    }

    /** @internal */
    npm(args, cwd) {
        const npmCli = process.env.npm_execpath;
        if (!npmCli) {
            throw new Error("npm_execpath is not set");
        }
        execFileSync(process.execPath, [npmCli, ...args], { cwd, stdio: "inherit" });
    }

    /** @internal */
    exec(command, args, cwd) {
        execFileSync(command, args, { cwd, stdio: "inherit" });
    }
}

class Workspace {
    #project;
    #pkg;

    constructor(project, dir) {
        this.#project = project;
        this.dir = dir;
        this._pkg = JSON.parse(readFileSync(path.join(project.path(dir), "package.json"), "utf8"));
    }

    get name() {
        return this._pkg.name;
    }

    get #dir() {
        return this.#project.path(this.dir);
    }

    get #dist() {
        return path.join(this.#dir, "build", "dist");
    }

    async stage() {
        await rm(this.#dist, { recursive: true, force: true });
        await mkdir(this.#dist, { recursive: true });

        const files = this._pkg.files;
        if (!files || files.length === 0) {
            throw new Error(`"files" field is empty in ${this.dir}/package.json`);
        }

        await cp(path.join(this.#dir, "package.json"), path.join(this.#dist, "package.json"));
        await cp(path.join(this.#dir, "README.md"), path.join(this.#dist, "README.md"));
        await cp(this.#project.path("LICENSE"), path.join(this.#dist, "LICENSE"));

        for (const f of files) {
            await cp(path.join(this.#dir, f), path.join(this.#dist, f), { recursive: true });
        }
    }

    packDryRun() {
        this.#project.npm(["pack", "--dry-run"], this.#dist);
    }

    publish() {
        this.#project.npm(["publish", "--access", "public"], this.#dist);
    }

    async clean() {
        for (const target of [...this._pkg.files, "build"]) {
            await rm(path.join(this.#dir, target), { recursive: true, force: true });
        }
    }

    setVersion(version) {
        this._pkg.version = version;
        this.#save();
    }

    setDependencyVersion(name, version) {
        if (this._pkg.dependencies?.[name] !== undefined) {
            this._pkg.dependencies[name] = version;
            this.#save();
        }
    }

    #save() {
        writeFileSync(path.join(this.#dir, "package.json"), `${JSON.stringify(this._pkg, null, 4)}\n`, "utf8");
    }
}

export class Release {
    #project;

    constructor(project) {
        this.#project = project;
    }

    prepare(version) {
        if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
            throw new Error(`Invalid version "${version}". Expected semver, for example 0.1.0`);
        }

        this.#project.assertClean();
        this.#bumpVersions(version);
        this.#project.build();
        this.#project.test();
        this.#project.stageAll();

        for (const ws of this.#project.workspaces()) {
            ws.packDryRun();
        }

        this.#commit(version);
    }

    publish() {
        this.#project.npm(["whoami"], this.#project.path());
        for (const ws of this.#project.workspaces()) {
            ws.publish();
        }
    }

    #bumpVersions(version) {
        this.#project.setVersion(version);
        for (const ws of this.#project.workspaces()) {
            ws.setVersion(version);
        }
        for (const ws of this.#project.workspaces()) {
            for (const dep of this.#project.workspaces()) {
                ws.setDependencyVersion(dep.name, version);
            }
        }
    }

    #commit(version) {
        const files = ["package.json"];
        for (const ws of this.#project.workspaces()) {
            files.push(path.join(ws.dir, "package.json"));
        }

        const root = this.#project.path();
        this.#project.exec("git", ["add", ...files], root);
        this.#project.exec("git", ["commit", "-m", `release: v${version}`], root);
        this.#project.exec("git", ["tag", `v${version}`], root);
    }
}
