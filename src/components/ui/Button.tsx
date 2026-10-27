import type {AnchorHTMLAttributes,ReactNode} from "react";
type Props=AnchorHTMLAttributes<HTMLAnchorElement>&{variant?:"primary"|"secondary";children:ReactNode};
export function Button({variant="primary",className="",children,...props}:Props){return <a className={`button button--${variant} ${className}`.trim()} {...props}>{children}</a>}
