import 'preact-router';
import type * as preact from 'preact';

declare module 'preact-router' {
    export function Link(
        props: preact.AnchorHTMLAttributes<HTMLAnchorElement>
    ): preact.VNode;
}
