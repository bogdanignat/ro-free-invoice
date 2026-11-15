import { useId } from "react"

import { cx } from "../ui/cx.ts"
import type { ChartMonth } from "../../lib/dashboard-view.ts"
import { money } from "../../lib/money.ts"
import { chartDescription, revenueChartModel, type ChartSeriesKey } from "../../lib/revenue-chart.ts"

interface RevenueChartProps {
  readonly months: ReadonlyArray<ChartMonth>
  readonly currency: string
}

const SERIES_COLOURS: Readonly<Record<ChartSeriesKey, { readonly bar: string; readonly swatch: string }>> = {
  invoiced: { bar: "fill-invoice-primary", swatch: "bg-invoice-primary" },
  collected: { bar: "fill-invoice-connected", swatch: "bg-invoice-connected" },
}

const AXIS_TEXT = "fill-invoice-muted text-[11px] tabular-nums"
const LEGEND_ITEM = "inline-flex gap-[.4rem] items-center"

/**
 * Grouped bars per month, drawn from `revenueChartModel`: this component maps
 * the geometry to SVG and decides nothing. For assistive technology the SVG is
 * one image with a name, and the exact amounts follow in a visually hidden table.
 */
export const RevenueChart = ({ months, currency }: RevenueChartProps) => {
  const captionId = useId()
  const chart = revenueChartModel(months, currency)
  return <figure>
    {/* `contain` keeps the drawing's width out of the card's min-content: a narrow card scrolls the chart instead of growing. */}
    <div className="overflow-x-auto pb-1 [contain:inline-size]">
      <svg className="block min-w-full h-auto" role="img" aria-label={chartDescription(months)} viewBox={`0 0 ${String(chart.width)} ${String(chart.height)}`}
        width={chart.width} height={chart.height}>
        {chart.ticks.map((tick) => <g key={tick.label}>
          <line className="stroke-invoice-border stroke-1" x1={chart.plotLeft} x2={chart.plotRight} y1={tick.y} y2={tick.y} />
          <text className={AXIS_TEXT} x={chart.plotLeft - 8} y={tick.y} dominantBaseline="middle" textAnchor="end">{tick.label}</text>
        </g>)}
        {chart.groups.map((group) => <g key={group.month}>
          {group.bars.map((bar) => <rect key={bar.key} className={SERIES_COLOURS[bar.key].bar}
            x={bar.x} y={bar.y} width={bar.width} height={bar.height}>
            <title>{bar.title}</title>
          </rect>)}
          <text className={AXIS_TEXT} x={group.center} y={chart.height - 24} textAnchor="middle">{group.monthLabel}</text>
          {group.yearLabel === undefined
            ? null
            : <text className={`${AXIS_TEXT} font-bold`} x={group.center} y={chart.height - 8} textAnchor="middle">{group.yearLabel}</text>}
        </g>)}
        <line className="stroke-invoice-label stroke-[1.5]" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.zeroY} y2={chart.zeroY} />
      </svg>
    </div>
    <figcaption id={captionId} className="flex flex-wrap gap-x-5 gap-y-2 items-center mt-3 text-invoice-muted text-[.8rem]">
      {chart.series.map((series) => <span key={series.key} className={LEGEND_ITEM}>
        <span className={cx("inline-block size-3 rounded-[.2rem]", SERIES_COLOURS[series.key].swatch)} aria-hidden="true" />{series.label}
      </span>)}
      <span className={LEGEND_ITEM}>Sume în {currency}, cu TVA</span>
    </figcaption>
    <table className="sr-only" aria-describedby={captionId}>
      <caption>Valorile graficului, pe luni</caption>
      <thead>
        <tr><th scope="col">Luna</th>{chart.series.map((series) => <th scope="col" key={series.key}>{series.label}</th>)}</tr>
      </thead>
      <tbody>
        {months.map((month) => <tr key={month.month}>
          <th scope="row">{month.label}</th>
          <td>{money(month.invoiced, currency)}</td>
          {month.collected === undefined ? null : <td>{money(month.collected, currency)}</td>}
        </tr>)}
      </tbody>
    </table>
  </figure>
}
