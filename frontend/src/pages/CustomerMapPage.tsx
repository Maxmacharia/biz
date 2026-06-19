import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useCustomersMap } from '@/api/hooks'
import { PageHeader, PageLoader, fmt } from '@/components/ui'
import { Users, TrendingUp, AlertCircle } from 'lucide-react'

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const getMarkerColor = (purchases: number, maxPurchases: number): string => {
  const ratio = maxPurchases > 0 ? purchases / maxPurchases : 0
  if (ratio > 0.7) return '#22c55e'   // green  – top tier
  if (ratio > 0.4) return '#3b82f6'   // blue   – mid tier
  if (ratio > 0.1) return '#f59e0b'   // amber  – low tier
  return '#ef4444'                     // red    – inactive
}

const createColoredIcon = (color: string, rank: number) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        background:${color};
        width:28px;height:28px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,.3);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);color:white;font-size:9px;font-weight:700;line-height:1">${rank}</span>
      </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  })

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) })
  return null
}

export default function CustomerMapPage() {
  const { data: customers, isLoading } = useCustomersMap()
  const [filter, setFilter] = useState<'all' | 'top' | 'debt'>('all')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [clickedPos, setClickedPos] = useState<{ lat: number; lng: number } | null>(null)

  const NAIROBI: [number, number] = [-1.2921, 36.8219]

  if (isLoading) return <PageLoader />

  const sorted = [...(customers || [])].sort((a, b) => b.total_purchases - a.total_purchases)
  const maxPurchases = sorted[0]?.total_purchases || 1

  const filtered = sorted.filter((c) => {
    if (filter === 'top') return c.total_purchases > 0
    if (filter === 'debt') return c.outstanding_balance > 0
    return true
  })

  const ranked = filtered.map((c, i) => ({ ...c, rank: i + 1 }))

  const withCoords = ranked.filter((c) => c.latitude && c.longitude)

  return (
    <div>
      <PageHeader
        title="Customer Map"
        subtitle={`${withCoords.length} customers with GPS locations`}
      />

      {/* Legend + Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* Filter buttons */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'top', 'debt'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                filter === f ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? 'All Customers' : f === 'top' ? 'With Purchases' : 'Has Debt'}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(e) => setShowHeatmap(e.target.checked)}
            className="rounded"
          />
          Show Purchase Radius
        </label>

        {/* Color legend */}
        <div className="flex items-center gap-3 text-xs text-gray-600">
          {[
            { color: '#22c55e', label: 'Top tier (>70%)' },
            { color: '#3b82f6', label: 'Mid tier (>40%)' },
            { color: '#f59e0b', label: 'Low tier (>10%)' },
            { color: '#ef4444', label: 'Inactive' },
          ].map(({ color, label }) => (
            <div key={color} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '520px' }}>
        <MapContainer center={NAIROBI} zoom={11} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={(lat, lng) => setClickedPos({ lat, lng })} />

          {withCoords.map((c) => {
            const color = getMarkerColor(c.total_purchases, maxPurchases)
            return (
              <Marker
                key={c.id}
                position={[c.latitude!, c.longitude!]}
                icon={createColoredIcon(color, c.rank)}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <div className="font-bold text-gray-900 text-sm mb-2">{c.name}</div>
                    {c.phone && <div className="text-xs text-gray-500 mb-1">📞 {c.phone}</div>}
                    {c.address && <div className="text-xs text-gray-500 mb-1">📍 {c.address}</div>}
                    <div className="text-xs mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Purchases</span>
                        <span className="font-semibold text-green-600">{fmt(c.total_purchases)}</span>
                      </div>
                      {c.outstanding_balance > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Outstanding</span>
                          <span className="font-semibold text-red-600">{fmt(c.outstanding_balance)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rank</span>
                        <span className="font-semibold">#{c.rank}</span>
                      </div>
                    </div>
                  </div>
                </Popup>
                {showHeatmap && (
                  <Circle
                    center={[c.latitude!, c.longitude!]}
                    radius={Math.max(200, (c.total_purchases / maxPurchases) * 800)}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1 }}
                  />
                )}
              </Marker>
            )
          })}

          {/* Clicked position marker */}
          {clickedPos && (
            <Marker position={[clickedPos.lat, clickedPos.lng]}>
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold mb-1">Selected Location</div>
                  <div>Lat: {clickedPos.lat.toFixed(6)}</div>
                  <div>Lng: {clickedPos.lng.toFixed(6)}</div>
                  <div className="mt-2 text-gray-400">Use these coords when adding a customer</div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Summary sidebar below map */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Customers on Map</div>
            <div className="text-xl font-bold text-gray-900">{withCoords.length}</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Top Customer Revenue</div>
            <div className="text-xl font-bold text-gray-900">{fmt(sorted[0]?.total_purchases || 0)}</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Total Outstanding Debt</div>
            <div className="text-xl font-bold text-gray-900">
              {fmt(sorted.reduce((s, c) => s + c.outstanding_balance, 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Ranked customer list */}
      {withCoords.length > 0 && (
        <div className="card mt-4">
          <div className="card-header">
            <h2 className="font-semibold text-gray-800">Customer Rankings</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {ranked.slice(0, 20).map((c) => {
              const color = getMarkerColor(c.total_purchases, maxPurchases)
              return (
                <div key={c.id} className="flex items-center gap-4 px-6 py-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: color }}
                  >
                    {c.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.address || 'No address'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-800">{fmt(c.total_purchases)}</div>
                    {c.outstanding_balance > 0 && (
                      <div className="text-xs text-red-500">Owes {fmt(c.outstanding_balance)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
