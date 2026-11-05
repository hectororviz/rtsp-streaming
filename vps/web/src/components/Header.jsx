import { useBrand } from "../settings";

export function Shield() {
  return (
    <svg width="30" height="36" viewBox="0 0 30 36" aria-hidden="true" focusable="false">
      <path
        d="M15 1.5 27 6v10.2c0 7.6-5 13.4-12 18.3C8 29.6 3 23.8 3 16.2V6L15 1.5Z"
        fill="none"
        stroke="#f2f4f5"
        strokeWidth="2"
      />
      <path d="M15 5.5 23.5 9v7.3c0 5.6-3.6 10-8.5 13.7-4.9-3.7-8.5-8.1-8.5-13.7V9L15 5.5Z" fill="var(--brand, #c4161c)" />
      <text x="15" y="19" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="system-ui">
        CS
      </text>
    </svg>
  );
}

export function BrandShield({ size = 30 }) {
  const { brand } = useBrand();
  if (brand.shield) {
    return (
      <img
        src={brand.shield}
        alt=""
        aria-hidden="true"
        width={size}
        height={Math.round((size * 36) / 30)}
        className="brand-shield"
      />
    );
  }
  return <Shield />;
}

export function BrandName() {
  const { brand } = useBrand();
  const words = brand.site_name.trim().split(/\s+/);
  const last = words.pop();
  return (
    <span className="brand-name">
      {words.length > 0 && <>{words.join(" ").toUpperCase()} </>}
      <span className="tv">{last.toUpperCase()}</span>
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="live-badge">
      <span className="live-dot" aria-hidden="true" />
      EN VIVO
    </span>
  );
}

export default function Header({ variant, onNav }) {
  const { brand } = useBrand();
  const isVivo = variant === "vivo";
  const label = isVivo ? "Inicio" : "Ver en vivo";
  const href = isVivo ? "/" : "/vivo";
  const cls = isVivo ? "btn-pill btn-pill--ghost" : "btn-pill btn-pill--red";

  function go(ev) {
    ev.preventDefault();
    onNav(href);
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <a
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNav("/");
            }}
            aria-label={`${brand.site_name} - inicio`}
          >
            <BrandShield />
            <BrandName />
          </a>
          <a className={cls} href={href} onClick={go}>
            {label}
          </a>
        </div>
      </header>
      <div className="header-line" aria-hidden="true" />
    </>
  );
}
