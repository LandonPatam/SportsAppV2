import React from 'react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';

const currentDate = new Date();
const month = currentDate.toLocaleString('default', { month: 'long' });
const year = currentDate.getFullYear();

const neonGlowStyles = {
  blue: {
    filter: 'drop-shadow(0 0 15px rgba(0, 4, 253, 1)) drop-shadow(0 0 1px rgba(4, 0, 255, 0.5))',
  },
  red: {
    filter: 'drop-shadow(0 0 3px #ff6161ff) drop-shadow(0 0 1px rgba(86, 0, 0, 0.5))',
  },
  white: {
    filter: 'drop-shadow(0 0 1px rgba(255,255,255, 1)) drop-shadow(0 0 1px rgba(255,255,255,0.15))',
  },
} satisfies Record<'blue' | 'red' | 'white', React.CSSProperties>;

type IconProps = {
  className?: string;
  active?: boolean;
};

type SidebarTheme = 'default' | 'nfl' | 'nba';

const gradientMap: Record<SidebarTheme, { from: string; to: string }> = {
  default: { from: "#5e70fbff", to: "#ffc342ff" },
  nfl: { from: "#5e70fbff", to: "#ffc342ff" },
  nba: { from: "#00ffeeff", to: "#cc00ffff" },
};

/* ============================================================================
 * ICONS — stylistically consistent but slightly varied
 * ============================================================================ */

// 🏈 NFL — football shape with stitches
const FootballIcon = ({ className, active = false }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 192.756 192.756"
    className={cn('h-32 w-32', className)}
    fill="none"
    strokeWidth={4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Outer Border */}
    <g stroke={active ? '#5e70fbff' : '#3a3a3aff'} style={active ? neonGlowStyles.blue : undefined}>
      <path d="M95.973 8.504c8.07 18.65 41.426 33.356 69.582 13.629v122.485c0 19.189-15.961 22.059-24.391 22.059-29.41 0-40.35 12.193-45.371 17.574-5.021-5.381-15.603-17.574-45.013-17.574-8.429 0-24.39-2.869-24.39-22.059V22.134c28.156 19.726 61.512 5.021 69.583-13.63z"/>
    </g>

    {/* Letters */}
    <g stroke={active ? '#E8F5C8' : '#3a3a3aff'} style={active ? neonGlowStyles.red : undefined}>
      <path d="M85.392 148.924c0 1.164 0 3.945-1.793 4.842s-2.152 2.062-1.973 2.779.986 1.525 2.421 1.973c1.435.449 4.125 1.346 12.105 7.174 1.434.896 2.87.357 3.317-.18.449-.537.629-2.062-.537-3.408-1.271-1.465-2.6-3.766-2.6-7.172v-33.447h8.159c1.973 0 3.945.539 4.574 3.945.537 2.242 3.676 2.602 3.676.18v-18.023c0-1.973-3.498-1.793-3.945.18-.449 1.973-.539 5.471-3.229 5.471h-9.235V95.123h10.042c1.525 0 3.049.538 3.945 1.793.898 1.256 3.678 4.574 5.561 3.766.896-.357 1.344-1.256.896-2.959l-4.215-11.387H83.599c-1.793 0-2.69.628-2.87 1.435-.179.807.359 2.332 1.614 2.959 1.255.628 3.049 1.883 3.049 4.753v53.441z"/>
      <path d="M121.438 141.301c0 1.256 0 4.305-1.793 5.74-1.793 1.434-6.188 5.559-4.305 8.068.719.986 2.691.719 5.201-.178 2.512-.896 9.863-1.166 12.553-1.076 2.691.09 15.424 2.42 20.445-12.645 3.318-10.4-1.346-22.686-10.67-22.865-5.291-.09-7.891 2.602-8.34 6.457s2.689 9.594 9.416 8.518c1.883-.357 2.33.27 2.33 1.795 0 1.523-.537 10.76-9.324 10.76-1.436 0-3.588.09-4.574.09V96.736c0-2.331 2.779-5.559 4.664-6.814 1.434-.896 1.344-3.587-.359-3.587h-19.189c-1.256 0-2.51 1.435-.717 3.318 1.793 1.883 4.662 3.317 4.662 7.442v44.206z"/>
      <path d="M39.034 86.335c-1.345 0-2.69.628-2.959 1.793-.226.978 0 2.511 1.435 3.139 1.435.628 3.587 1.883 3.587 5.201v39.991c0 1.525-.18 3.676-2.242 3.408-2.062-.27-2.601.717-2.69 1.344-.09.629.269 4.844 6.187 8.699 1.973 1.254 7.532 4.932 9.774 3.137 1.076-.807-.09-4.662-1.166-5.916-1.076-1.256-1.793-2.781-1.793-4.934v-31.383l15.423 40.262c1.076 2.689 4.483 5.289 6.994 4.482 2.511-.807 2.87-2.779 2.87-4.395V95.482c0-1.614.089-3.049 3.228-4.753 1.614-.717 2.242-4.394-.627-4.394h-16.05c-1.883 0-3.139 2.331-1.345 3.766 1.793 1.435 5.47 3.228 5.47 6.188v25.914L53.111 90.909c-.986-2.421-2.69-4.573-4.573-4.573h-9.504v-.001z"/>
    </g>

    {/* Football body + stitches */}
    <g stroke={active ? '#ffffffff' : '#3a3a3aff'} style={active ? neonGlowStyles.white : undefined}>
      <path d="M83.778 61.408l.896 2.152-12.643 5.111c5.021 6.725 19.996 8.07 30.576 2.511 10.162-5.339 16.947-12.105 18.293-22.148l-12.555 4.977-.807-2.062 12.375-5.066c-1.705-2.69-14.795-8.967-29.86-2.78-13.809 4.932-19.278 17.306-19.009 22.417l12.734-5.112z"/>

      <g>
        <path d="M87.611 63.686a.776.776 0 0 0 .428-1.009l-1.144-2.828a.775.775 0 0 0-1.009-.428l-.173.043a.776.776 0 0 0-.428 1.009l1.144 2.829a.775.775 0 0 0 1.008.428l.174-.044z"/>
        <path d="M90.346 62.61a.774.774 0 0 0 .428-1.008l-1.144-2.829a.775.775 0 0 0-1.008-.428l-.174.043a.775.775 0 0 0-.428 1.009l1.144 2.829a.775.775 0 0 0 1.009.428l.173-.044z"/>
        <path d="M93.081 61.534a.775.775 0 0 0 .428-1.008l-1.144-2.829a.776.776 0 0 0-1.009-.428l-.173.043a.774.774 0 0 0-.428 1.008l1.144 2.829a.775.775 0 0 0 1.008.428l.174-.043z"/>
        <path d="M95.815 60.458a.775.775 0 0 0 .428-1.008L95.1 56.621a.775.775 0 0 0-1.008-.428l-.173.043a.775.775 0 0 0-.428 1.009l1.144 2.829a.776.776 0 0 0 1.009.428l.171-.044z"/>
        <path d="M98.549 59.382a.775.775 0 0 0 .43-1.009l-1.145-2.829a.775.775 0 0 0-1.008-.428l-.173.044a.774.774 0 0 0-.428 1.008l1.145 2.829a.775.775 0 0 0 1.008.429l.171-.044z"/>
        <path d="M101.285 58.306a.776.776 0 0 0 .428-1.009l-1.145-2.829a.775.775 0 0 0-1.008-.428l-.174.043a.775.775 0 0 0-.428 1.008l1.145 2.829a.774.774 0 0 0 1.008.429l.174-.043z"/>
        <path d="M104.02 57.23a.776.776 0 0 0 .428-1.009l-1.143-2.829a.777.777 0 0 0-1.01-.428l-.172.043a.775.775 0 0 0-.43 1.009l1.145 2.829a.774.774 0 0 0 1.008.428l.174-.043z"/>
        <path d="M106.754 56.154a.772.772 0 0 0 .428-1.009l-1.143-2.828a.775.775 0 0 0-1.008-.428l-.174.043a.775.775 0 0 0-.428 1.008l1.143 2.829a.775.775 0 0 0 1.01.428l.172-.043z"/>
      </g>
    </g>
  </svg>
);
// 🏀 NBA — balanced basketball icon (contained within circle)
const NBAIcon = ({ className, active = false }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 255 700"
    className={cn('h-60 w-54', className)}
    fill="none"
  >
    <g stroke={active ? '#00ffeeff' : '#6b7280'} strokeWidth={5} fill="none" style={active ? neonGlowStyles.blue : undefined}>
      <path d="M197.43 503.7c.497-8.029.332-10.678-.754-11.985-.824-.994-1.408-4.093-1.432-7.609-.036-5.326-.751-7.315-7.006-19.461-6.674-12.965-6.913-13.673-5.727-16.952 1.105-3.06.948-4.088-1.47-9.664-2.412-5.562-3.497-6.774-9.957-11.134-12.532-8.457-22.604-17.08-39.377-33.705-18.725-18.567-34.272-38.982-48.689-63.937-5.006-8.664-5.398-9.024-9.82-9.047-3.32-.017-7.307-2.913-7.292-5.301.004-.692-4.059-9.642-9.029-19.886-12.898-26.586-14.001-32.248-10.057-51.606 2.341-11.478 2.781-12.51 7.663-17.915 5.183-5.735 4.37-7.35-4.119-8.189-11.341-1.123-11.225-1.052-13.576-8.329-1.156-3.579-2.102-7.635-2.102-9.013 0-4.567 5.186-19.02 12.316-34.325 3.868-8.306 8.828-19.633 11.021-25.171 7.803-19.708 18.568-35.466 27.26-39.901 3.475-1.773 10.229-3.106 30.328-5.989 11.188-1.605 11.976-2.418 13.583-14.014.935-6.744.842-7.801-.924-10.661-1.274-2.06-1.962-4.976-1.962-8.314 0-4.694.263-5.277 3.021-6.703 2.666-1.378 3.021-2.085 3.021-6.017 0-9.406 1.897-14.643 7.176-19.777a88.325 88.325 0 0 0 3.67-3.77H74.065c-23.482 0-42.52 19.037-42.52 42.52v433.586c0 23.482 19.037 42.521 42.52 42.521H200.55c-.427-.941-1.319-2.465-2.354-3.974-2.878-4.189-2.846-2.718-.766-36.278z" />
    </g>
    <g stroke={active ? '#cc00ffff' : '#6b7280'} strokeWidth={5} fill="none" style={active ? neonGlowStyles.red : undefined}>
      <path d="M203.236 25.325h-36.615c.359.427.877.886 1.507 1.299 4.528 2.966 11.396 10.111 12.492 12.994 1.649 4.341 1.278 10.107-1.05 16.333-1.338 3.574-1.901 6.772-1.523 8.656.712 3.561-2.785 11.11-6.926 14.95-1.493 1.384-3.609 4.26-4.702 6.392-1.093 2.131-3.806 5.848-6.026 8.258s-3.889 5.152-3.703 6.093c.184.942 2.826 3.053 5.871 4.692 3.047 1.639 7.606 4.855 10.135 7.147 2.527 2.292 7.63 6.312 11.339 8.933 13.327 9.421 19.722 25.53 19.788 49.848.029 10.776 5.285 36.033 9.05 43.492 5.157 10.216 7.024 15.848 8.638 26.043 2.072 13.101 2.135 13.249 6.301 14.989 3.981 1.664 14.293 10.035 14.293 11.604 0 .54 1.02 2.41 2.265 4.157l1.39 1.947V67.844c-.004-23.483-19.041-42.519-42.524-42.519zm41.886 284.716c0 .51-2.242 3.379-4.981 6.377-19.104 20.9-51.799 16.244-63.801-9.09-2.904-6.132-3.207-7.672-3.207-16.335 0-8.271.366-10.345 2.698-15.323 3.729-7.956 10.847-15.244 18.628-19.076 3.54-1.742 6.646-3.504 6.898-3.916.254-.411-2.941-7.623-7.102-16.029-9.583-19.365-10.718-22.828-15.066-45.959-1.967-10.455-3.778-19.574-4.029-20.267-.805-2.229-3.618-1.36-10.575 3.264l-6.806 4.524-6.168 15.623c-3.391 8.591-6.168 16.898-6.168 18.457 0 1.755.998 3.767 2.613 5.277 4.031 3.767 5.119 6.533 11.951 30.398 5.034 17.58 6.156 22.716 5.354 24.481-.771 1.688-.271 5.393 2.047 15.171 3.408 14.388 4.679 22.013 6.268 37.606 1.611 15.829 3.315 20.844 12.486 36.75 6.097 10.571 7.969 16.943 12.25 41.693 1.964 11.357 3.947 21.354 4.408 22.214.462.86 2.457 3.971 4.435 6.91 5.438 8.083 6.259 11.802 4.304 19.58-.894 3.553-1.904 8.906-2.246 11.896-.687 5.984 1.479 20.478 3.938 26.365.831 1.987 1.282 4.482 1.005 5.546-.279 1.064.885 6.382 2.583 11.817 5.313 16.998 5.078 24.208-1.041 31.935-1.096 1.384-1.685 2.171-2.036 2.702 18.391-4.684 31.994-21.354 31.994-41.204V309.186c-.369.137-.634.466-.634.855z" />
    </g>
    <g stroke={active ? '#ffffffff' : '#9ca3af'} strokeWidth={5} fill="none" style={active ? neonGlowStyles.white : undefined}>
      <path d="M46.676 448.242h17.189l9.916 43.835h.166v-43.835h14.379v71.132H71.468l-10.247-43.935h-.166v43.935H46.676v-71.132zM95.768 448.242h23.223c10.991 0 16.114 7.073 16.114 17.732 0 7.571-2.728 14.347-9.255 15.939v.199c7.768.896 10.909 8.867 10.909 16.238 0 12.354-4.958 21.021-17.768 21.021H95.768v-71.129zm15.371 27.895h3.72c3.14 0 4.876-3.387 4.876-7.173 0-3.985-1.736-7.372-4.876-7.372h-3.72v14.545zm0 29.887h4.298c2.81 0 5.454-2.989 5.454-8.768 0-5.479-2.645-8.567-5.454-8.567h-4.298v17.335zM152.057 448.242h19.338l14.379 71.132H169.41l-1.57-12.453h-12.23l-1.569 12.453h-16.366l14.382-71.132zm9.75 14.545h-.164l-4.215 30.187h8.594l-4.215-30.187z" />
    </g>
  </svg>
);
/* ============================================================================
 * SIDEBAR COMPONENT
 * ============================================================================ */

interface SidebarProps {
  className?: string;
}

interface SidebarProps {
  className?: string;
  theme?: SidebarTheme;
  onHoverChange?: (state: boolean) => void;
}

interface NavItem {
  title: string;
  icon: React.ComponentType<IconProps>;
  href: string;
  offsetY?: number;
  offsetX?: number;
}

export function Sidebar({ className, theme = 'default', onHoverChange }: SidebarProps) {
  const location = useLocation();
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [isHovered, setIsHovered] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('sidebarExpanded') === 'true';
  });

  const gradient = gradientMap[theme] || gradientMap.default;

  const navItems: NavItem[] = [
    { title: '', icon: FootballIcon, href: '/nfl', offsetY: 140, offsetX: 0 },
    { title: '', icon: NBAIcon, href: '/nba', offsetY: 140, offsetX: -6 },
  ];

  const totalItems = navItems.length;
  const expandedPercent = 25;
  const expandedBasis = `${expandedPercent}%`;
  const collapsedBasis =
    totalItems > 1 ? `calc((100% - ${expandedPercent}%) / ${totalItems - 1})` : '100%';

  React.useEffect(() => {
    onHoverChange?.(isHovered);
  }, [isHovered, onHoverChange]);

  return (
    <aside
      className={cn(
        'fixed top-6 bottom-6 left-0 z-40 transition-all duration-300 ease-in-out rounded-r-3xl overflow-hidden',
        isHovered ? 'w-[120px] bg-transparent' : 'w-[14px]',
        className
      )}
      style={{
        backgroundImage: !isHovered ? `linear-gradient(180deg, ${gradient.from}, ${gradient.to})` : undefined,
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange?.(true);
        if (typeof window !== 'undefined') window.sessionStorage.setItem('sidebarExpanded', 'true');
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredIndex(null);
        onHoverChange?.(false);
        if (typeof window !== 'undefined') window.sessionStorage.setItem('sidebarExpanded', 'false');
      }}
    >
      <nav
        className={cn(
          'flex flex-col flex-1 justify-between py-0 h-full transition-opacity duration-200',
          isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex flex-col flex-1 gap-6 px-3 py-10">
          {navItems.map((item, index) => {
            const isActive = location.pathname.startsWith(item.href);
            const shouldGlow = isActive || hoveredIndex === index;
            return (
              <Link
                key={index}
                to={item.href}
                className={cn(
                  'group inline-flex flex-col items-center justify-center gap-3 px-4 py-3 rounded-xl',
                  'transition-all duration-300 ease-in border border-transparent',
                  isActive ? 'text-white' : 'text-white/70 hover:text-white'
                )}
                style={{ marginTop: item.offsetY ?? 0, marginLeft: item.offsetX ?? 0 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex((prev) => (prev === index ? null : prev))}
              >
                <item.icon
                  className={cn(
                    'transition-all duration-300 transform group-hover:scale-110',
                    isActive
                      ? 'text-white'
                      : 'text-white/80 group-hover:text-white'
                  )}
                  active={shouldGlow}
                />
                <span
                  className={cn(
                    'text-xs font-semibold tracking-wide',
                    isActive ? 'text-white' : 'text-white/70'
                  )}
                >
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>

        {/* === FOOTER (Month/Year) === */}
       
      </nav>
    </aside>
  );
}
