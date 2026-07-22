const pathShim = {
    join(...parts: string[]): string {
        return parts.join("/");
    },
    resolve(...parts: string[]): string {
        return parts.join("/");
    },
    dirname(value: string): string {
        const parts = value.split("/");
        parts.pop();
        return parts.join("/") || ".";
    },
    isAbsolute(value: string): boolean {
        return value.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(value);
    },
};

export default pathShim;
