import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Coins,
  Cpu,
  FolderKanban,
  Languages,
  RefreshCw,
  RotateCcw,
  Sparkles,
  SpellCheck,
  TrendingUp,
} from "lucide-react";
import DesktopManager from "../../utils/desktop";
import { ROUTES } from "../../constants/routes";
import { useSessionGuards } from "../../hooks/useSessionGuards";
import LoadingState from "../../components/LoadingState/LoadingState";
import EmptyState from "../../components/EmptyState/EmptyState";
import Toast from "../../components/Toast/Toast";
import { useNotification } from "../../hooks/useNotification";
import type { TranslationMetricRecord } from "./types";
import {
  aggregateMetrics,
  applyDatePreset,
  DEFAULT_FILTERS,
  filterRecords,
  formatInteger,
  formatNumber,
  getUniqueValues,
  type MetricsFilters,
} from "./utils/aggregateMetrics";
import "./admin-metrics.css";

type DatePreset = "7d" | "30d" | "90d" | "all" | "custom";

function MetricsFilter({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="metrics-filter-field">
      <span className="metrics-filter-label">
        {icon}
        {label}
      </span>
      <select
        className="metrics-filter-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function HeroStat({
  label,
  value,
  sub,
  icon,
  tone = "cyan",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  tone?: "cyan" | "success" | "warning" | "pink";
}) {
  return (
    <div className={`metrics-hero-stat metrics-hero-stat-${tone}`}>
      <div className="metrics-hero-stat-icon">{icon}</div>
      <div className="metrics-hero-stat-copy">
        <span className="metrics-hero-stat-label">{label}</span>
        <strong className="metrics-hero-stat-value">{value}</strong>
        {sub ? <span className="metrics-hero-stat-sub">{sub}</span> : null}
      </div>
    </div>
  );
}

function QualityBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone =
    clamped >= 85 ? "high" : clamped >= 70 ? "mid" : "low";
  return (
    <div className="metrics-quality-cell">
      <div className="metrics-quality-track">
        <div
          className={`metrics-quality-fill metrics-quality-fill-${tone}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span>{formatNumber(clamped, 0)}%</span>
    </div>
  );
}

export default function AdminMetricsPage() {
  const { navigate } = useSessionGuards();
  const { notification, showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [records, setRecords] = useState<TranslationMetricRecord[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [filters, setFilters] = useState<MetricsFilters>(DEFAULT_FILTERS);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  const bootstrap = async () => {
    setLoading(true);
    try {
      const desktop = DesktopManager.getInstance();
      const token = await desktop.getConfig("github_token");
      const userData = await desktop.getConfig("github_user");

      if (!token || !userData?.login) {
        navigate(ROUTES.login);
        return;
      }

      const roleResult = await desktop.verifyUserRole(token, userData.login);
      const admin = roleResult.role === "administrador";
      setIsAdmin(admin);

      if (!admin) {
        showNotification("warning", "Solo administradores pueden ver métricas");
        setTimeout(() => navigate(ROUTES.dashboard), 1500);
        return;
      }

      await loadMetrics(false);
    } catch (error: any) {
      showNotification("error", error.message || "Error al cargar métricas");
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (showRefreshState = true) => {
    if (showRefreshState) setRefreshing(true);
    try {
      const desktop = DesktopManager.getInstance();
      const result = await desktop.getAiMetrics();
      setRecords(result.records);
      setProjects(result.projects);
    } catch (error: any) {
      showNotification("error", error.message || "Error al leer métricas");
    } finally {
      if (showRefreshState) setRefreshing(false);
    }
  };

  const filteredRecords = useMemo(
    () => filterRecords(records, filters),
    [records, filters],
  );

  const aggregated = useMemo(
    () => aggregateMetrics(filteredRecords),
    [filteredRecords],
  );

  const providers = useMemo(() => getUniqueValues(records, "provider"), [records]);
  const models = useMemo(
    () =>
      getUniqueValues(
        filters.provider === "all"
          ? records
          : records.filter((record) => record.provider === filters.provider),
        "model",
      ),
    [records, filters.provider],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.project !== "all") count += 1;
    if (filters.provider !== "all") count += 1;
    if (filters.model !== "all") count += 1;
    if (filters.spellcheck !== "all") count += 1;
    if (filters.dateFrom || filters.dateTo) count += 1;
    return count;
  }, [filters]);

  const handleDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const range = applyDatePreset(preset);
    setFilters((current) => ({ ...current, ...range }));
  };

  const updateFilter = <K extends keyof MetricsFilters>(
    key: K,
    value: MetricsFilters[K],
  ) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "provider") {
        next.model = "all";
      }
      return next;
    });
    if (key === "dateFrom" || key === "dateTo") {
      setDatePreset("custom");
    }
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDatePreset("all");
  };

  if (loading || isAdmin === null) {
    return (
      <div className="metrics-container">
        <div className="metrics-loading-wrap">
          <LoadingState message="Cargando métricas..." />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="metrics-container">
        <div className="metrics-loading-wrap">
          <LoadingState message="Redirigiendo..." />
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-container">
      {notification ? <Toast notification={notification} /> : null}

      <header className="metrics-topbar">
        <button
          type="button"
          className="metrics-back-btn"
          onClick={() => navigate(ROUTES.dashboard)}
        >
          <ArrowLeft size={16} />
          Volver al inicio
        </button>

        <button
          type="button"
          className="metrics-refresh-btn"
          onClick={() => loadMetrics(true)}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "metrics-spin" : ""} />
          {refreshing ? "Actualizando..." : "Actualizar"}
        </button>
      </header>

      <div className="metrics-content">
        <div className="metrics-page-head">
          <div className="metrics-page-title-row">
            <div className="metrics-page-icon">
              <BarChart3 size={22} />
            </div>
            <div>
              <div className="metrics-page-title-line">
                <h1>Métricas de traducciones</h1>
                <span className="metrics-live-badge">Repos locales</span>
              </div>
              <p className="metrics-page-subtitle">
                Calidad, correcciones y uso de IA por proyecto e idioma
              </p>
            </div>
          </div>
        </div>

        <section className="metrics-toolbar">
          <div className="metrics-toolbar-top">
            <div className="metrics-timeline" role="tablist" aria-label="Período">
              {(["7d", "30d", "90d", "all"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  role="tab"
                  aria-selected={datePreset === preset}
                  className={`metrics-timeline-btn ${datePreset === preset ? "active" : ""}`}
                  onClick={() => handleDatePreset(preset)}
                >
                  {preset === "all" ? "Todo" : preset.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="metrics-toolbar-actions">
              {activeFilterCount > 0 ? (
                <span className="metrics-filter-count">
                  {activeFilterCount} filtro{activeFilterCount === 1 ? "" : "s"}
                </span>
              ) : null}
              <button type="button" className="metrics-reset-btn" onClick={resetFilters}>
                <RotateCcw size={14} />
                Restablecer
              </button>
            </div>
          </div>

          <div className="metrics-filter-grid">
            <MetricsFilter
              label="Proyecto"
              icon={<FolderKanban size={14} />}
              value={filters.project}
              onChange={(value) => updateFilter("project", value)}
              options={[
                { value: "all", label: "Todos los proyectos" },
                ...projects.map((project) => ({ value: project, label: project })),
              ]}
            />
            <MetricsFilter
              label="Proveedor"
              icon={<Cloud size={14} />}
              value={filters.provider}
              onChange={(value) => updateFilter("provider", value)}
              options={[
                { value: "all", label: "Todos los proveedores" },
                ...providers.map((provider) => ({ value: provider, label: provider })),
              ]}
            />
            <MetricsFilter
              label="Modelo"
              icon={<Cpu size={14} />}
              value={filters.model}
              onChange={(value) => updateFilter("model", value)}
              options={[
                { value: "all", label: "Todos los modelos" },
                ...models.map((model) => ({ value: model, label: model })),
              ]}
            />
            <MetricsFilter
              label="Corrector"
              icon={<SpellCheck size={14} />}
              value={filters.spellcheck}
              onChange={(value) => updateFilter("spellcheck", value)}
              options={[
                { value: "all", label: "Todos" },
                { value: "yes", label: "Con corrector" },
                { value: "no", label: "Sin corrector" },
              ]}
            />
          </div>

          <div className="metrics-date-row">
            <label className="metrics-date-field">
              <span>Desde</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
              />
            </label>
            <label className="metrics-date-field">
              <span>Hasta</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
              />
            </label>
          </div>
        </section>

        {records.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={48} />}
            title="Sin métricas disponibles"
            description="No se encontraron métricas en los repos de juegos. Verificá que exista Localizacion/metricas_ia.json tras traducir."
          />
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon={<Calendar size={48} />}
            title="Sin resultados para estos filtros"
            description="Probá ampliar el rango de fechas o cambiar el proyecto seleccionado."
          />
        ) : (
          <>
            <section className="metrics-overview-grid">
              <div className="metrics-panel metrics-overview-main">
                <div className="metrics-panel-head">
                  <h2>
                    <Languages size={18} />
                    Calidad por idioma
                  </h2>
                  <span className="metrics-panel-meta">
                    {aggregated.languageAverages.length} idiomas
                  </span>
                </div>

                {aggregated.languageAverages.length === 0 ? (
                  <p className="metrics-panel-empty">Sin datos de idiomas</p>
                ) : (
                  <div className="metrics-table-wrap">
                    <table className="metrics-table metrics-table-quality">
                      <thead>
                        <tr>
                          <th>Idioma</th>
                          <th>Confianza</th>
                          <th>Léxico</th>
                          <th>Sentido</th>
                          <th>Mediciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aggregated.languageAverages.map((lang) => (
                          <tr key={lang.lang}>
                            <td className="metrics-table-locale">{lang.lang}</td>
                            <td><QualityBar value={lang.confidence} /></td>
                            <td><QualityBar value={lang.lexical} /></td>
                            <td><QualityBar value={lang.meaning} /></td>
                            <td className="metrics-table-num">{formatInteger(lang.runs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <aside className="metrics-overview-side">
                <HeroStat
                  label="Confianza promedio"
                  value={`${formatNumber(aggregated.avgConfidence, 0)}%`}
                  sub={`Léxico ${formatNumber(aggregated.avgLexical, 0)}% · Sentido ${formatNumber(aggregated.avgMeaning, 0)}%`}
                  icon={<Brain size={20} />}
                  tone="pink"
                />
                <HeroStat
                  label="Traducciones"
                  value={formatInteger(aggregated.totalRuns)}
                  sub={`${formatInteger(aggregated.totalTexts)} textos procesados`}
                  icon={<Sparkles size={20} />}
                  tone="cyan"
                />
                <HeroStat
                  label="Tasa de corrección"
                  value={`${formatNumber(aggregated.avgCorrectionRate)}%`}
                  sub={`${formatInteger(aggregated.totalCorrected)} textos corregidos`}
                  icon={<CheckCircle2 size={20} />}
                  tone="success"
                />
                <HeroStat
                  label="Tokens totales"
                  value={formatInteger(aggregated.totalTokens)}
                  sub={`${formatInteger(Math.round(aggregated.avgTokensPerRun))} promedio / ejecución`}
                  icon={<Coins size={20} />}
                  tone="warning"
                />
              </aside>
            </section>

            <section className="metrics-summary-strip">
              <div className="metrics-summary-item">
                <TrendingUp size={16} />
                <span>Corrector ortográfico</span>
                <strong>{formatInteger(aggregated.runsWithSpellcheck)}</strong>
              </div>
              <div className="metrics-summary-item">
                <TrendingUp size={16} />
                <span>Similitud léxica</span>
                <strong>{formatInteger(aggregated.runsWithLexical)}</strong>
              </div>
              <div className="metrics-summary-item">
                <TrendingUp size={16} />
                <span>Embeddings</span>
                <strong>{formatInteger(aggregated.runsWithEmbeddings)}</strong>
              </div>
              <div className="metrics-summary-item">
                <Coins size={16} />
                <span>Tokens traducción</span>
                <strong>{formatInteger(aggregated.translationTokens)}</strong>
              </div>
              <div className="metrics-summary-item">
                <Coins size={16} />
                <span>Tokens corrector</span>
                <strong>{formatInteger(aggregated.spellcheckTokens)}</strong>
              </div>
            </section>

            <button
              type="button"
              className="metrics-details-toggle"
              onClick={() => setShowDetails((current) => !current)}
            >
              {showDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              {showDetails ? "Ocultar detalles" : "Ver más detalles"}
            </button>

            {showDetails ? (
              <div className="metrics-details">
                <section className="metrics-tables-grid">
                  <div className="metrics-panel">
                    <div className="metrics-panel-head">
                      <h2>Por proveedor</h2>
                    </div>
                    <div className="metrics-table-wrap">
                      <table className="metrics-table">
                        <thead>
                          <tr>
                            <th>Proveedor</th>
                            <th>Ejecuciones</th>
                            <th>Tokens</th>
                            <th>Corrección</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregated.providerBreakdown.map((row) => (
                            <tr key={row.provider}>
                              <td>{row.provider}</td>
                              <td className="metrics-table-num">{formatInteger(row.runs)}</td>
                              <td className="metrics-table-num">{formatInteger(row.tokens)}</td>
                              <td className="metrics-table-num">{formatNumber(row.avgCorrectionRate)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="metrics-panel">
                    <div className="metrics-panel-head">
                      <h2>Por proyecto</h2>
                    </div>
                    <div className="metrics-table-wrap">
                      <table className="metrics-table">
                        <thead>
                          <tr>
                            <th>Proyecto</th>
                            <th>Ejecuciones</th>
                            <th>Tokens</th>
                            <th>Confianza</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregated.projectBreakdown.map((row) => (
                            <tr key={row.project}>
                              <td>{row.project}</td>
                              <td className="metrics-table-num">{formatInteger(row.runs)}</td>
                              <td className="metrics-table-num">{formatInteger(row.tokens)}</td>
                              <td className="metrics-table-num">{formatNumber(row.avgConfidence, 0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className="metrics-panel metrics-recent-panel">
                  <div className="metrics-panel-head">
                    <h2>
                      <Calendar size={18} />
                      Ejecuciones recientes
                    </h2>
                  </div>
                  <div className="metrics-recent-list">
                    {filteredRecords.slice(0, 15).map((record) => (
                      <article key={record.id} className="metrics-recent-item">
                        <div className="metrics-recent-main">
                          <strong>{record.project}</strong>
                          <span>{record.file}</span>
                        </div>
                        <div className="metrics-recent-meta">
                          <span>{record.date}</span>
                          <span>{record.provider} · {record.model}</span>
                          <span>{formatNumber(record.correctionRate ?? 0)}% corr.</span>
                          <span>{formatInteger(record.tokens?.total ?? 0)} tokens</span>
                        </div>
                        <div className="metrics-recent-tags">
                          {record.spellcheck ? <span className="tag tag-spell">Corrector</span> : null}
                          {record.similarity?.lexical ? <span className="tag tag-lex">Léxico</span> : null}
                          {record.similarity?.embeddings ? <span className="tag tag-emb">Embeddings</span> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
