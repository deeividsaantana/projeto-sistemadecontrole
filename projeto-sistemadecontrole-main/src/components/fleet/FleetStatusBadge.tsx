import type { FleetOperationalStatus } from '../../fleet/domain';
import { getFleetStatusDefinition } from '../../fleet/status';

interface Props {
  status: FleetOperationalStatus;
  compact?: boolean;
}

export default function FleetStatusBadge({ status, compact = false }: Props) {
  const definition = getFleetStatusDefinition(status);
  return (
    <span
      title={definition.description}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full font-bold ring-1 ring-inset ring-current/15 ${definition.textClass} ${definition.backgroundClass} ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      <span className="truncate">{status}</span>
    </span>
  );
}
