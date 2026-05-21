import React, { useEffect, useState } from 'react';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { TopBar } from './shared/TopBar';
import { Server, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { pb } from '../lib/pocketbase';

interface OpenApiPath {
  [method: string]: {
    summary?: string;
    description?: string;
    tags?: string[];
    operationId?: string;
    parameters?: any[];
    requestBody?: any;
    responses?: Record<string, any>;
    deprecated?: boolean;
  };
}

interface OpenApiSpec {
  openapi: string;
  info: { title?: string; version?: string; description?: string };
  paths: Record<string, OpenApiPath>;
  tags?: { name: string; description?: string }[];
}

const METHOD_COLORS: Record<string, string> = {
  get: 'bg-green-100 text-green-800 border-green-300',
  post: 'bg-blue-100 text-blue-800 border-blue-300',
  put: 'bg-orange-100 text-orange-800 border-orange-300',
  patch: 'bg-orange-100 text-orange-800 border-orange-300',
  delete: 'bg-red-100 text-red-800 border-red-300',
  head: 'bg-purple-100 text-purple-800 border-purple-300',
  options: 'bg-gray-100 text-gray-800 border-gray-300',
};

const MethodBadge = ({ method }: { method: string }) => {
  const color = METHOD_COLORS[method.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-300';
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold uppercase border ${color}`}
    >
      {method}
    </span>
  );
};

const ApiDocs = () => {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpec = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (pb.authStore.token) {
        headers['Authorization'] = `Bearer ${pb.authStore.token}`;
      }
      const res = await fetch('/api/todoless/swagger', { headers });
      if (!res.ok) {
        throw new Error(`Failed to load API docs (${res.status} ${res.statusText})`);
      }
      const data: OpenApiSpec = await res.json();
      setSpec(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load API documentation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpec();
  }, []);

  // Group paths by tag
  const pathsByTag = React.useMemo(() => {
    if (!spec) return new Map<string, { path: string; method: string; details: OpenApiPath[string] }[]>();

    const map = new Map<string, { path: string; method: string; details: OpenApiPath[string] }[]>();

    // Collect defined tags with their order
    const tagOrder = spec.tags?.map(t => t.name) || [];

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, details] of Object.entries(methods)) {
        const tags = details.tags && details.tags.length > 0 ? details.tags : ['default'];
        for (const tag of tags) {
          if (!map.has(tag)) {
            map.set(tag, []);
          }
          map.get(tag)!.push({ path, method, details });
        }
      }
    }

    // Sort entries within each tag by path
    for (const [, endpoints] of map) {
      endpoints.sort((a, b) => a.path.localeCompare(b.path));
    }

    // Return a sorted map based on tag order (or alphabetical)
    const sorted = new Map<string, { path: string; method: string; details: OpenApiPath[string] }[]>();
    const allTags = [...tagOrder, ...[...map.keys()].filter(t => !tagOrder.includes(t))];
    for (const tag of allTags) {
      if (map.has(tag)) {
        sorted.set(tag, map.get(tag)!);
      }
    }

    return sorted;
  }, [spec]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-[calc(env(safe-area-inset-bottom,0px)+112px)]">
        <TopBar />
        <NewGlobalHeader showSearch={false} showAdd={false} showFilters={false} />
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-10">
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
              <p className="text-sm text-neutral-500">Loading API documentation...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-[calc(env(safe-area-inset-bottom,0px)+112px)]">
        <TopBar />
        <NewGlobalHeader showSearch={false} showAdd={false} showFilters={false} />
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-10">
          <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-2">Failed to Load API Docs</h2>
            <p className="text-sm text-neutral-600 mb-4">{error}</p>
            <button
              onClick={fetchSpec}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm hover:bg-neutral-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-[calc(env(safe-area-inset-bottom,0px)+112px)]">
      <TopBar />
      <NewGlobalHeader showSearch={false} showAdd={false} showFilters={false} />

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 space-y-6">
        {/* Header Card */}
        {spec && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5 text-neutral-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-neutral-900">
                  {spec.info?.title || 'API Documentation'}
                </h1>
                {spec.info?.version && (
                  <span className="text-xs text-neutral-500 font-mono">v{spec.info.version}</span>
                )}
                {spec.info?.description && (
                  <p className="text-sm text-neutral-600 mt-1">{spec.info.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
                  <span className="font-mono">{spec.openapi}</span>
                  <span className="text-neutral-300">·</span>
                  <span>{Object.keys(spec.paths).length} endpoints</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Endpoints grouped by tag */}
        {[...pathsByTag.entries()].map(([tag, endpoints]) => (
          <div key={tag} className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            {/* Tag Header */}
            <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
              <h2 className="text-sm font-semibold text-neutral-800 capitalize">{tag}</h2>
              {spec?.tags?.find(t => t.name === tag)?.description && (
                <p className="text-xs text-neutral-500 mt-0.5">
                  {spec.tags.find(t => t.name === tag)!.description}
                </p>
              )}
              <span className="text-[11px] text-neutral-400 font-medium">{endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Endpoint List */}
            <div className="divide-y divide-neutral-100">
              {endpoints.map(({ path, method, details }) => (
                <div key={`${method}-${path}`} className="px-4 py-3 hover:bg-neutral-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <MethodBadge method={method} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <code className="text-sm font-mono text-neutral-800 break-all">{path}</code>
                      {details.summary && (
                        <p className="text-sm text-neutral-600 mt-1">{details.summary}</p>
                      )}
                      {details.description && !details.summary && (
                        <p className="text-sm text-neutral-500 mt-1">{details.description}</p>
                      )}
                      {details.deprecated && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] font-medium rounded border border-red-200">
                          deprecated
                        </span>
                      )}
                      {/* Parameters snippet */}
                      {details.parameters && details.parameters.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {details.parameters.slice(0, 5).map((param: any, i: number) => (
                            <span
                              key={i}
                              className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded"
                            >
                              {param.required ? (
                                <span className="text-red-500">*</span>
                              ) : null}
                              {param.name}: {param.in}
                            </span>
                          ))}
                          {details.parameters.length > 5 && (
                            <span className="text-[10px] text-neutral-400">
                              +{details.parameters.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApiDocs;
