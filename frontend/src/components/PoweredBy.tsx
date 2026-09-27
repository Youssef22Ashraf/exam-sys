import { Icon } from "./Icon";

const PORTFOLIO_URL =
  import.meta.env.VITE_PORTFOLIO_URL || "https://portfolio-five-rosy-60.vercel.app/";

interface PoweredByProps {
  prefix?: string;
  className?: string;
}

export function PoweredBy({
  prefix = "Powered by",
  className = "",
}: PoweredByProps) {
  return (
    <a
      href={PORTFOLIO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`powered-by-tag ${className}`.trim()}
      title="Eng. Youssef Ashraf — DevOps & Cloud Infrastructure Engineer Portfolio (Opens in new tab)"
      aria-label={`${prefix} Eng. Youssef Ashraf - Visit Portfolio (opens in new tab)`}
    >
      <span className="powered-by-icon" aria-hidden="true">
        <Icon name="zap" />
      </span>
      <span className="powered-by-prefix">{prefix}</span>
      <span className="powered-by-name">Eng. Youssef Ashraf</span>
      <span className="powered-by-ext" aria-hidden="true">
        <Icon name="external-link" size={11} strokeWidth={2.2} />
      </span>
    </a>
  );
}
