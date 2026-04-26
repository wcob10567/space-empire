import { useAuth } from '../context/AuthContext'
import RenamePlanet from '../components/RenamePlanet'

const TEMP_COLORS = {
  hot:    'text-red-400',
  warm:   'text-orange-400',
  mild:   'text-yellow-400',
  cool:   'text-cyan-400',
  cold:   'text-blue-400',
}

function getTempColor(temp) {
  if (temp > 60)  return TEMP_COLORS.hot
  if (temp > 30)  return TEMP_COLORS.warm
  if (temp > 10)  return TEMP_COLORS.mild
  if (temp > -10) return TEMP_COLORS.cool
  return TEMP_COLORS.cold
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function ResourceBar({ label, current, cap, color }) {
  const pct = cap > 0 ? Math.min((current / cap) * 100, 100) : 0
  const isAlmostFull = pct > 85
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`text-sm font-mono font-medium ${isAlmostFull ? 'text-red-400' : color}`}>
          {Math.floor(current).toLocaleString()} / {Math.floor(cap).toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isAlmostFull ? 'bg-red-500' : 'bg-cyan-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isAlmostFull && (
        <p className="text-xs text-red-400 mt-1">⚠ Storage almost full!</p>
      )}
    </div>
  )
}

export default function Overview({ planet, resources, buildings, profile, setProfile }) {

  // ← REMOVED the duplicate: const { profile } = useAuth()

  const metalMine   = buildings?.find(b => b.building_type === 'metal_mine')?.level ?? 0
  const crystalMine = buildings?.find(b => b.building_type === 'crystal_mine')?.level ?? 0
  const deutSynth   = buildings?.find(b => b.building_type === 'deuterium_synthesizer')?.level ?? 0
  const solarPlant  = buildings?.find(b => b.building_type === 'solar_plant')?.level ?? 0

  const metalProd   = Math.floor(30 * metalMine * 1.1 ** metalMine)
  const crystalProd = Math.floor(20 * crystalMine * 1.1 ** crystalMine)
  const deutProd    = Math.floor(10 * deutSynth * 1.1 ** deutSynth)
  const energyProd  = Math.floor(20 * solarPlant * 1.1 ** solarPlant)

  return (
    <div className="space-y-6 w-full">
      {/* Planet Header */}
      <div className="bg-gray-900 border border-cyan-900/50 rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <RenamePlanet
                planet={planet}
                profile={profile}
                onRenamed={(newName) => window.location.reload()}
                onProfileUpdate={setProfile}
                />
            <p className="text-gray-400 mt-1">
              Galaxy {planet?.galaxy} · System {planet?.system} · Position {planet?.position}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Commander: <span className="text-white">{profile?.username}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Temperature</p>
            <p className={`text-2xl font-bold ${getTempColor(planet?.temperature ?? 20)}`}>
              {planet?.temperature ?? 20}°C
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {planet?.used_fields ?? 0} / {planet?.max_fields ?? 163} fields used
            </p>
          </div>
        </div>
      </div>

      {/* Planet Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Diameter"     value={`${(planet?.diameter ?? 12800).toLocaleString()} km`} />
        <StatCard label="Metal Mine"   value={`Lv. ${metalMine}`}   sub={`+${metalProd.toLocaleString()}/hr`} />
        <StatCard label="Crystal Mine" value={`Lv. ${crystalMine}`} sub={`+${crystalProd.toLocaleString()}/hr`} />
        <StatCard label="Solar Plant"  value={`Lv. ${solarPlant}`}  sub={`${energyProd} energy`} />
      </div>

      {/* Resource Storage */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Resource Storage</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <ResourceBar label="Metal"     current={resources?.metal ?? 0}     cap={resources?.metal_cap ?? 10000}     color="text-gray-300" />
          <ResourceBar label="Crystal"   current={resources?.crystal ?? 0}   cap={resources?.crystal_cap ?? 10000}   color="text-cyan-300" />
          <ResourceBar label="Deuterium" current={resources?.deuterium ?? 0} cap={resources?.deuterium_cap ?? 10000} color="text-blue-300" />
        </div>
      </div>

      {/* Hourly Production */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Hourly Production</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Metal/hr"     value={metalProd.toLocaleString()}   sub="from mines" />
          <StatCard label="Crystal/hr"   value={crystalProd.toLocaleString()} sub="from mines" />
          <StatCard label="Deuterium/hr" value={deutProd.toLocaleString()}     sub="from synthesizer" />
          <StatCard label="Energy"       value={energyProd}                    sub="solar output" />
        </div>
      </div>
    </div>
  )
}