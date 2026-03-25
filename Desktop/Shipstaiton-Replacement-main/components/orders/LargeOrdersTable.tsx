'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import OrderDialog from '../dialogs/OrderDialog'
import PushToQueueDialog from '../dialogs/PushToQueueDialog'
import PackingSlipButton from '../shared/PackingSlipButton'
import { getColorFromSku, getSizeFromSku, isShippingInsurance } from '@/lib/order-utils'
import { useExpeditedFilter, isOrderExpedited, isOrderPersonalized } from '@/context/ExpeditedFilterContext'
import { useOrders } from '@/context/OrdersContext'
import type { OrderLog } from '@/context/OrdersContext'
import { checkOrderReadiness, countReady } from '@/lib/order-readiness'

// ============================================================================
// Types
// ============================================================================

interface LargeOrdersTableProps {
  orders: OrderLog[]
}

interface ProcessedOrder {
  log: OrderLog
  order: any
  items: Array<{
    sku: string
    name: string
    quantity: number
    color: string
    size: string
  }>
  totalQty: number
  binsNeeded: number
  boxName: string | null
  customerName: string
  orderDate: string
}

const DEFAULT_BIN_CAPACITY = 24

// ============================================================================
// Main Component
// ============================================================================

export default function LargeOrdersTable({ orders }: LargeOrdersTableProps) {
  const { expeditedFilter } = useExpeditedFilter()
  const { refreshOrders } = useOrders()

  // Bin capacity from settings
  const [binCapacity, setBinCapacity] = useState(DEFAULT_BIN_CAPACITY)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        const setting = (data.settings || []).find((s: any) => s.key === 'bin_capacity_limit')
        if (setting?.value?.limit != null) setBinCapacity(setting.value.limit)
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true))
  }, [])

  // UI State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [selectedRawPayload, setSelectedRawPayload] = useState<any | null>(null)
  const [selectedLog, setSelectedLog] = useState<OrderLog | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPushDialogOpen, setIsPushDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [readinessFilter, setReadinessFilter] = useState<'all' | 'ready' | 'not-ready'>('all')
  const [pushMessage, setPushMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Process orders — filter to those exceeding bin capacity
  const processedOrders = useMemo(() => {
    if (!settingsLoaded) return []

    return orders
      .map((log) => {
        if (log.batchId || log.status === 'ON_HOLD') return null
        if (isOrderPersonalized(log.rawPayload)) return null

        const payload = log.rawPayload as any
        const order = Array.isArray(payload) ? payload[0] : payload
        const items = (order?.items || []).filter(
          (item: any) => !isShippingInsurance(item.sku || '', item.name || '')
        )

        if (items.length === 0) return null

        const processedItems = items.map((item: any) => ({
          sku: item.sku || 'N/A',
          name: item.name || 'Unknown',
          quantity: item.quantity || 1,
          color: getColorFromSku(item.sku || '', item.name, item.color),
          size: getSizeFromSku(item.sku || ''),
        }))

        const totalQty = processedItems.reduce((sum: number, item: any) => sum + item.quantity, 0)

        // Only include orders that exceed bin capacity
        if (totalQty <= binCapacity) return null

        const binsNeeded = Math.ceil(totalQty / binCapacity)
        const boxName = log.suggestedBox?.boxName || null
        const customerName = order?.shipTo?.name || order?.billTo?.name || 'Unknown'
        const orderDate = order?.orderDate || log.createdAt

        return {
          log,
          order,
          items: processedItems,
          totalQty,
          binsNeeded,
          boxName,
          customerName,
          orderDate: typeof orderDate === 'string' ? orderDate : String(orderDate),
        } as ProcessedOrder
      })
      .filter((o): o is ProcessedOrder => o !== null)
  }, [orders, binCapacity, settingsLoaded])

  // Apply filters
  const filteredOrders = useMemo(() => {
    let result = processedOrders

    // Expedited filter
    if (expeditedFilter === 'only') {
      result = result.filter(o => {
        const cr = (o.log as any).customerReachedOut || false
        return isOrderExpedited(o.log.rawPayload, cr, (o.log as any).orderType)
      })
    } else if (expeditedFilter === 'hide') {
      result = result.filter(o => {
        const cr = (o.log as any).customerReachedOut || false
        return !isOrderExpedited(o.log.rawPayload, cr, (o.log as any).orderType)
      })
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o =>
        o.log.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.items.some(i => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
      )
    }

    // Readiness filter
    if (readinessFilter !== 'all') {
      result = result.filter(o => {
        const { ready } = checkOrderReadiness(o.log)
        if (readinessFilter === 'ready') return ready
        return !ready
      })
    }

    // Sort by total qty descending
    result.sort((a, b) => b.totalQty - a.totalQty)

    return result
  }, [processedOrders, searchQuery, expeditedFilter, readinessFilter])

  // Selection helpers
  const selectableOrders = filteredOrders.filter(o => !o.log.batchId)
  const allSelected = selectableOrders.length > 0 && selectableOrders.every(o => selectedOrderIds.has(o.log.orderNumber))

  const toggleSelection = (orderNumber: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev)
      if (next.has(orderNumber)) next.delete(orderNumber)
      else next.add(orderNumber)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(selectableOrders.map(o => o.log.orderNumber)))
    }
  }

  const selectedCount = selectedOrderIds.size > 0 ? selectedOrderIds.size : filteredOrders.length

  const handleOrderSaved = useCallback((updatedOrder: any) => {
    if (updatedOrder?.id && refreshOrders) refreshOrders()
  }, [refreshOrders])

  const viewedIndex = selectedLog ? filteredOrders.findIndex(o => o.log.id === selectedLog.id) : -1
  const navigateTo = useCallback((idx: number) => {
    const o = filteredOrders[idx]
    if (!o) return
    setSelectedOrder(o.order)
    setSelectedRawPayload(o.log.rawPayload)
    setSelectedLog(o.log)
  }, [filteredOrders])
  const handleNavPrev = useCallback(() => { if (viewedIndex > 0) navigateTo(viewedIndex - 1) }, [viewedIndex, navigateTo])
  const handleNavNext = useCallback(() => { if (viewedIndex < filteredOrders.length - 1) navigateTo(viewedIndex + 1) }, [viewedIndex, filteredOrders.length, navigateTo])

  // Push handler
  const handlePushToQueue = useCallback(async (cellIds: string[], customName?: string) => {
    const orderNumbers = selectedOrderIds.size > 0
      ? Array.from(selectedOrderIds)
      : filteredOrders.map(o => o.log.orderNumber)

    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumbers,
        cellIds,
        type: 'ORDER_BY_SIZE',
        isPersonalized: false,
        customName,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to create batch')
    }

    const data = await res.json()
    setPushMessage({
      type: 'success',
      text: `Created batch "${data.batch.name}" with ${data.summary.totalOrders} orders → ${data.summary.cellsAssigned} cell(s)`,
    })

    setSelectedOrderIds(new Set())
    if (refreshOrders) refreshOrders()
  }, [selectedOrderIds, filteredOrders, refreshOrders])

  if (!settingsLoaded) {
    return <div className="text-gray-500 text-sm py-4">Loading settings...</div>
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-3">
        <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-indigo-700">
          Showing orders with total quantity exceeding <strong>{binCapacity}</strong> items (bin capacity limit).
          Adjust in <a href="/settings" className="underline font-medium">Settings &rarr; Picking Configuration</a>.
        </span>
      </div>

      {/* Message */}
      {pushMessage && (
        <div className={`p-3 rounded-lg text-sm ${
          pushMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {pushMessage.text}
          <button onClick={() => setPushMessage(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Readiness filter */}
      {(() => {
        const { ready, notReady } = countReady(processedOrders.map(o => o.log))
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase mr-1">Label Ready:</span>
            {([
              { key: 'all' as const, label: 'All', count: ready + notReady, color: 'gray' },
              { key: 'ready' as const, label: 'Ready', count: ready, color: 'green' },
              { key: 'not-ready' as const, label: 'Not Ready', count: notReady, color: 'red' },
            ]).map(({ key, label, count, color }) => (
              <button
                key={key}
                onClick={() => setReadinessFilter(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  readinessFilter === key
                    ? color === 'green' ? 'bg-green-600 text-white'
                      : color === 'red' ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-white'
                    : color === 'green' ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : color === 'red' ? 'bg-red-50 text-red-700 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )
      })()}

      {/* Search + Action bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            placeholder="Search order #, customer, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {filteredOrders.length} orders
            {selectedOrderIds.size > 0 && ` (${selectedOrderIds.size} selected)`}
          </span>
          <PackingSlipButton
            getOrders={() => filteredOrders.map(o => ({
              orderNumber: o.log.orderNumber,
              customerName: o.customerName,
              shipTo: o.order?.shipTo || { name: o.customerName },
              items: o.items.map(i => ({ sku: i.sku, name: i.name, quantity: i.quantity })),
            }))}
            disabled={filteredOrders.length === 0}
          />
          <button
            onClick={() => setIsPushDialogOpen(true)}
            disabled={filteredOrders.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            Push to Queue ({selectedCount})
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">Ready</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bins Needed</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Box</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Missing</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No orders exceed the bin capacity limit of {binCapacity}
                </td>
              </tr>
            ) : (
              filteredOrders.slice(0, 200).map((o) => {
                const isSelected = selectedOrderIds.has(o.log.orderNumber)
                const readiness = checkOrderReadiness(o.log)
                return (
                  <tr
                    key={o.log.id}
                    onClick={() => { setSelectedOrder(o.order); setSelectedRawPayload(o.log.rawPayload); setSelectedLog(o.log); setIsDialogOpen(true) }}
                    className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-indigo-50' : ''}`}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(o.log.orderNumber)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {readiness.ready ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-500">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-gray-900">
                      {o.log.orderNumber}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {o.items.map((item, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                            {item.quantity}× {item.sku}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">
                        {o.totalQty}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">
                        {o.binsNeeded} bin{o.binsNeeded !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        o.boxName ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {o.boxName || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-800">{o.customerName}</td>
                    <td className="px-4 py-2 text-sm">
                      {readiness.missing.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {readiness.missing.map(field => (
                            <span key={field} className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">
                              {field}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-green-600">All set</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(o.orderDate).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {filteredOrders.length > 200 && (
          <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t">
            Showing first 200 of {filteredOrders.length} orders
          </div>
        )}
      </div>

      {/* Push to Queue Dialog */}
      <PushToQueueDialog
        isOpen={isPushDialogOpen}
        onClose={() => setIsPushDialogOpen(false)}
        onConfirm={handlePushToQueue}
        orderCount={selectedCount}
        batchType="ORDER_BY_SIZE"
        isPersonalized={false}
        description="Large Orders"
      />

      {/* Order Detail Dialog */}
      <OrderDialog
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setSelectedOrder(null); setSelectedRawPayload(null); setSelectedLog(null) }}
        order={selectedOrder}
        rawPayload={selectedRawPayload}
        orderLog={selectedLog}
        onSaved={handleOrderSaved}
        onPrev={viewedIndex > 0 ? handleNavPrev : null}
        onNext={viewedIndex >= 0 && viewedIndex < filteredOrders.length - 1 ? handleNavNext : null}
      />
    </div>
  )
}
