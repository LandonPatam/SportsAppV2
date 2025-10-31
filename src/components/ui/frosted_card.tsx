import React from "react";

type FrostedCardProps = {
  title?: string;
  logo?: string;
  url?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  accentStart?: string;
  accentEnd?: string;
};

export const FrostedCard = ({
  title = "Aurora Design",
  logo = "?",
  url = "aurora.io",
  children,
  className = "",
  style,
  onClick,
  accentStart = "hsl(223,90%,60%)",
  accentEnd = "hsl(223,90%,50%)",
}: FrostedCardProps) => {
  return (
    <div
      className={`relative w-full overflow-visible ${className}`}
      style={style}
      onClick={onClick}
    >
      {/* === Base Accent Card (slight offset) === */}
      <div
        className="absolute inset-0 rounded-xl shadow-md"
        style={{
          backgroundImage: `linear-gradient(90deg, ${accentStart}, ${accentEnd})`,
          transform: "translate(0px, 0px)",
          filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.15))",
        }}
        aria-hidden
      />

      {/* === Foreground Frosted Panel === */}
      <div className="relative rounded-xl overflow-hidden">
        {/* Glass background */}
        <div
          className="absolute inset-0 backdrop-blur-xl saturate-150"
          style={{
            backgroundImage:
              "linear-gradient(90deg, hsla(0,0%,100%,0.18), hsla(0,0%,100%,0.06))",
          }}
          aria-hidden
        />

        {/* Subtle borders using masks */}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            maskImage: "linear-gradient(135deg, white, transparent 55%)",
            WebkitMaskImage: "linear-gradient(135deg, white, transparent 55%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            border: `1px solid ${accentEnd}`,
            opacity: 0.35,
            maskImage: "linear-gradient(135deg, transparent 55%, white)",
            WebkitMaskImage: "linear-gradient(135deg, transparent 55%, white)",
          }}
          aria-hidden
        />

        {/* Content */}
        <div className="relative z-10 w-full h-full p-5">
          {children ? (
            children
          ) : (
            <div className="h-full flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <h3 className="font-serif text-2xl font-bold">{title}</h3>
                <div className="text-3xl font-bold">{logo}</div>
              </div>
              <p className="text-sm self-end">{url}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
