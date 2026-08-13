import React from 'react';
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
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border font-black ${definition.textClass} ${definition.backgroundClass} ${definition.borderClass} ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'}`}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      <span className="truncate">{status}</span>
    </span>
  );
}
