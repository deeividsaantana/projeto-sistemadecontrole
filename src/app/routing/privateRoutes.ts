/** URL contract only. A valid URL never grants access to its organization. */
export const PRIVATE_MODULES = [
  'home', 'pending', 'registries', 'materials', 'inventory', 'equipment',
  'fleet', 'fuel', 'travels', 'stakes', 'field', 'presence', 'rdo',
  'maintenance', 'reports', 'management', 'admin',
] as const;

export type PrivateModule = typeof PRIVATE_MODULES[number];

export interface PrivateRoute {
  organizationId: string;
  projectId: string;
  module: PrivateModule;
  rest: string[];
}

const validSegment = (value: string) => value.length > 0
  && value.length <= 128
  && value !== '.'
  && value !== '..'
  && !/[\\/\u0000-\u001f\u007f]/.test(value);

const decodeSegment = (value: string): string | null => {
  try {
    const decoded = decodeURIComponent(value);
    return validSegment(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

export const parsePrivatePath = (pathname: string): PrivateRoute | null => {
  const parts = pathname.split('/');
  if (parts[0] !== '' || parts[1] !== 'app' || parts.length < 5) return null;
  const organizationId = decodeSegment(parts[2]);
  const projectId = decodeSegment(parts[3]);
  const module = parts[4];
  if (!organizationId || !projectId || !PRIVATE_MODULES.includes(module as PrivateModule)) return null;
  const rest = parts.slice(5).filter(Boolean).map(decodeSegment);
  if (rest.some(part => part === null)) return null;
  return { organizationId, projectId, module: module as PrivateModule, rest: rest as string[] };
};

export const buildPrivatePath = (route: PrivateRoute): string => {
  const parts = [route.organizationId, route.projectId, route.module, ...route.rest];
  if (!PRIVATE_MODULES.includes(route.module) || parts.some(part => !validSegment(part))) {
    throw new Error('Rota privada inválida.');
  }
  return `/app/${parts.map(encodeURIComponent).join('/')}`;
};
