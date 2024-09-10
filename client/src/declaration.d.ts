declare module '*.css' {
	const mapping: Record<string, string>;
	export default mapping;
}

declare module '*.wav' {
    const src: string;
    export default src;
}

declare module '*.mp3' {
    const src: string;
    export default src;
}

declare module '*.ogg' {
    const src: string;
    export default src;
}

declare module '*.json' {
    const content: any;
    export default content;
}