type IconProps = { className?: string }

const svgProps = {
  viewBox: '0 0 16 16',
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

export const LockIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...svgProps} className={className}>
    <rect x="3" y="7" width="10" height="6.5" rx="1.5" />
    <path d="M5 7V5a3 3 0 0 1 6 0v2" />
  </svg>
)

export const UnlockIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...svgProps} className={className}>
    <rect x="3" y="7" width="10" height="6.5" rx="1.5" />
    <path d="M5 7V5a3 3 0 0 1 5.8-1" />
  </svg>
)

export const SearchIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...svgProps} className={className}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3.5 3.5" />
  </svg>
)

export const CloseIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...svgProps} className={className}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
)

export const MoreIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...svgProps} fill="currentColor" stroke="none" className={className}>
    <circle cx="3.5" cy="8" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="12.5" cy="8" r="1.4" />
  </svg>
)

export const SortIcon: React.FC<
  IconProps & { direction: 'asc' | 'desc' | false }
> = ({ className, direction }) => (
  <svg {...svgProps} className={className}>
    <path
      d="m5 6.5 3-3 3 3"
      opacity={direction === 'desc' ? 0.25 : direction === 'asc' ? 1 : 0.4}
    />
    <path
      d="m5 9.5 3 3 3-3"
      opacity={direction === 'asc' ? 0.25 : direction === 'desc' ? 1 : 0.4}
    />
  </svg>
)
