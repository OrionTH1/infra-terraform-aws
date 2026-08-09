import {
  BellRing,
  Bomb,
  Boxes,
  ChevronDown,
  Container,
  Database,
  Gauge,
  Waypoints,
  Route,
  Package,
  ScrollText,
  Siren,
  KeyRound,
  HardDrive,
  Hand,
  Network,
  RefreshCw,
  ShieldCheck,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

const STROKE_WIDTH = 1.75

export interface IconProps {
  className?: string
}

interface GlyphProps extends IconProps {
  icon: LucideIcon
  size: number
}

function Glyph({ icon: Icon, size, className }: GlyphProps) {
  return <Icon size={size} strokeWidth={STROKE_WIDTH} absoluteStrokeWidth className={className} />
}

export function LoadBalancerIcon({ className }: IconProps) {
  return <Glyph icon={Network} size={16} className={className} />
}

export function EcsServiceIcon({ className }: IconProps) {
  return <Glyph icon={Boxes} size={16} className={className} />
}

export function TaskIcon({ className }: IconProps) {
  return <Glyph icon={Container} size={16} className={className} />
}

export function AutoScalingIcon({ className }: IconProps) {
  return <Glyph icon={Gauge} size={16} className={className} />
}

export function RdsIcon({ className }: IconProps) {
  return <Glyph icon={Database} size={16} className={className} />
}

export function UserIcon({ className }: IconProps) {
  return <Glyph icon={User} size={16} className={className} />
}

export function StorageIcon({ className }: IconProps) {
  return <Glyph icon={HardDrive} size={16} className={className} />
}

export function UserGroupIcon({ className }: IconProps) {
  return <Glyph icon={Users} size={16} className={className} />
}

export function WafIcon({ className }: IconProps) {
  return <Glyph icon={ShieldCheck} size={16} className={className} />
}

export function EndpointIcon({ className }: IconProps) {
  return <Glyph icon={Waypoints} size={16} className={className} />
}

export function GatewayIcon({ className }: IconProps) {
  return <Glyph icon={Route} size={16} className={className} />
}

export function RegistryIcon({ className }: IconProps) {
  return <Glyph icon={Package} size={16} className={className} />
}

export function LogsIcon({ className }: IconProps) {
  return <Glyph icon={ScrollText} size={16} className={className} />
}

export function AlarmIcon({ className }: IconProps) {
  return <Glyph icon={Siren} size={16} className={className} />
}

export function NotifyIcon({ className }: IconProps) {
  return <Glyph icon={BellRing} size={16} className={className} />
}

export function SecretIcon({ className }: IconProps) {
  return <Glyph icon={KeyRound} size={16} className={className} />
}

export function RegenerateIcon({ className }: IconProps) {
  return <Glyph icon={RefreshCw} size={11} className={className} />
}

export function RemoveIcon({ className }: IconProps) {
  return <Glyph icon={X} size={11} className={className} />
}

export function ChevronIcon({ className }: IconProps) {
  return <Glyph icon={ChevronDown} size={13} className={className} />
}

export function HandIcon({ className }: IconProps) {
  return <Glyph icon={Hand} size={18} className={className} />
}

export function BlastIcon({ className }: IconProps) {
  return <Glyph icon={Bomb} size={18} className={className} />
}
