import { useState, useEffect, useRef, useCallback } from "react"

const SUPABASE_URL = "https://kikwlrbqptewcjldxglk.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpa3dscmJxcHRld2NqbGR4Z2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyMzY5MDAsImV4cCI6MjA2MzgxMjkwMH0.PW0uEwj09VV1DMaxijcELZT1GS0g0bXnlmx-J1F7dyQ"

const PLAYER_COLORS = [
  "#C9A84C","#3B82F6","#10B981","#EF4444","#8B5CF6",
  "#EC4899","#F59E0B","#06B6D4","#F97316","#84CC16",
  "#E879F9","#38BDF8","#FB923C","#A78BFA","#34D399",
  "#FCD34D","#F472B6","#60A5FA","#4ADE80","#C084FC",
  "#FF6B6B","#7DD3FC","#86EFAC","#FCA5A5","#67E8F9",
]

function getStageLabel(stage) {
  const map = { group:"Group Stage", last_32:"Round of 32", last_16:"Round of 16", qf:"Quarter-Final", sf:"Semi-Final", "3rd":"3rd Place", final:"Final" }
  return map[stage] ?? stage?.toUpperCase()
}

function getStageColor(stage) {
  const map = { group:"#374151", last_32:"#1D4ED8", last_16:"#7C3AED", qf:"#B45309", sf:"#DC2626", "3rd":"#6B7280", final:"#C9A84C" }
  return map[stage] ?? "#374151"
}

function btnStyle(bg, color="#e8e0d0", extra={}) {
  return { background:bg, color, border:"1px solid rgba(255,255,255,0.12)", borderRadius:"8px", padding:"7px 14px", fontSize:"12px", fontWeight:"600", cursor:"pointer", ...extra }
}

export default function LeaderboardRace() {
  const [snapshots, setSnapshots] = useState([])
  const [colorMap, setColorMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1000)
  const [topN, setTopN] = useState(12)
  const intervalRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/predictions?select=points_earned,profiles!predictions_user_id_fkey(display_name),fixtures!predictions_match_id_fkey(kickoff_at,stage,home_team:teams!fixtures_home_team_id_fkey(name),away_team:teams!fixtures_away_team_id_fkey(name))&points_earned=not.is.null&order=fixtures(kickoff_at).asc`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        process(data)
      } catch(e) {
        setError(e.message)
        setLoading(false)
      }
    }

    function process(raw) {
      const matchOrder = []
      const matchSeen = new Set()
      const allPlayers = new Set()

      raw.forEach(row => {
        const f = row.fixtures
        if (!f) return
        const kickoff = f.kickoff_at
        const home = f.home_team?.name
        const away = f.away_team?.name
        const player = row.profiles?.display_name
        if (!player || !home || !away) return
        allPlayers.add(player)
        const key = `${kickoff}|${home}|${away}`
        if (!matchSeen.has(key)) {
          matchSeen.add(key)
          matchOrder.push({ key, kickoff, home, away, stage: f.stage })
        }
      })

      const players = [...allPlayers].sort()
      const colors = {}
      players.forEach((p, i) => { colors[p] = PLAYER_COLORS[i % PLAYER_COLORS.length] })
      setColorMap(colors)

      const running = {}
      players.forEach(p => { running[p] = 0 })

      const snaps = matchOrder.map(({ key, kickoff, home, away, stage }) => {
        raw.forEach(row => {
          const f = row.fixtures
          if (!f) return
          const k2 = `${f.kickoff_at}|${f.home_team?.name}|${f.away_team?.name}`
          if (k2 !== key) return
          const player = row.profiles?.display_name
          const pts = row.points_earned ?? 0
          if (player && running[player] !== undefined) running[player] += pts
        })
        return { match: `${home} vs ${away}`, kickoff, stage, totals: { ...running } }
      })

      setSnapshots(snaps)
      setLoading(false)
    }

    load()
  }, [])

  const stop = useCallback(() => { clearInterval(intervalRef.current); setPlaying(false) }, [])

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentIdx(prev => {
          if (prev >= snapshots.length - 1) { clearInterval(intervalRef.current); setPlaying(false); return prev }
          return prev + 1
        })
      }, speed)
    }
    return () => clearInterval(intervalRef.current)
  }, [playing, speed, snapshots.length])

  if (loading) return (
    <div style={{ background:"#0a0d12", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#C9A84C", fontFamily:"system-ui" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"32px", marginBottom:"12px" }}>⚽</div>
        <div style={{ fontSize:"13px", letterSpacing:"3px", textTransform:"uppercase" }}>Loading Race Data…</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ background:"#0a0d12", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#EF4444", fontFamily:"system-ui", padding:"20px", textAlign:"center" }}>
      <div>
        <div style={{ fontSize:"24px", marginBottom:"8px" }}>⚠️</div>
        <div style={{ fontSize:"13px" }}>Could not load data: {error}</div>
        <div style={{ fontSize:"11px", color:"#6B7280", marginTop:"8px" }}>Check Supabase RLS allows anon reads on predictions</div>
      </div>
    </div>
  )

  const snap = snapshots[currentIdx]
  const rankings = Object.entries(snap?.totals ?? {}).sort((a,b) => b[1]-a[1]).slice(0, topN)
  const maxPts = rankings[0]?.[1] ?? 1
  const isFinal = currentIdx === snapshots.length - 1
  const progress = ((currentIdx + 1) / snapshots.length) * 100

  return (
    <div style={{ background:"#0a0d12", minHeight:"100vh", fontFamily:"system-ui, sans-serif", color:"#e8e0d0", padding:"14px 12px", boxSizing:"border-box", maxWidth:"480px", margin:"0 auto" }}>

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:"12px" }}>
        <div style={{ fontSize:"10px", letterSpacing:"4px", color:"#C9A84C", textTransform:"uppercase", marginBottom:"2px" }}>
          PBS PICKS PRO · WORLD CUP 2026
        </div>
        <div style={{ fontSize:"20px", fontWeight:"800", letterSpacing:"3px", textTransform:"uppercase" }}>
          LEADERBOARD RACE
        </div>
      </div>

      {/* Match badge */}
      <div style={{ background:"#1a1f2e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"10px", padding:"10px 12px", marginBottom:"12px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px" }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:"9px", color:"#6B7280", letterSpacing:"2px", textTransform:"uppercase" }}>
            Match {currentIdx+1} / {snapshots.length}
          </div>
          <div style={{ fontSize:"13px", fontWeight:"700", marginTop:"2px", color:"#e8e0d0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {snap?.match}
          </div>
          <div style={{ fontSize:"10px", color:"#6B7280", marginTop:"1px" }}>
            {snap?.kickoff ? new Date(snap.kickoff).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : ""}
          </div>
        </div>
        <div style={{ background:getStageColor(snap?.stage), borderRadius:"20px", padding:"4px 10px", fontSize:"9px", fontWeight:"700", letterSpacing:"1px", textTransform:"uppercase", flexShrink:0 }}>
          {getStageLabel(snap?.stage)}
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ marginBottom:"10px" }}>
        {rankings.map(([player, points], i) => {
          const color = colorMap[player] ?? "#94A3B8"
          const pct = Math.max(2, (points / maxPts) * 100)
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null
          return (
            <div key={player} style={{ marginBottom:"5px", display:"flex", alignItems:"center", gap:"6px" }}>
              <div style={{ width:"22px", textAlign:"right", fontSize:"10px", fontWeight:"700", flexShrink:0,
                color: i===0?"#C9A84C": i===1?"#94A3B8": i===2?"#B45309":"#4B5563" }}>
                {medal ?? (i+1)}
              </div>
              <div style={{ width:"95px", fontSize:"11px", fontWeight:i<3?"700":"500", flexShrink:0,
                color:i<3?"#e8e0d0":"#9CA3AF", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {player}
              </div>
              <div style={{ flex:1, background:"rgba(255,255,255,0.04)", borderRadius:"4px", height:"22px", overflow:"hidden" }}>
                <div style={{
                  width:`${pct}%`, height:"100%",
                  background:`linear-gradient(90deg, ${color}77, ${color})`,
                  borderRadius:"4px",
                  transition:"width 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  display:"flex", alignItems:"center", justifyContent:"flex-end",
                  paddingRight:"6px", boxSizing:"border-box", minWidth:"28px"
                }}>
                  <span style={{ fontSize:"10px", fontWeight:"700", color:"#fff", textShadow:"0 1px 3px rgba(0,0,0,0.9)" }}>
                    {points}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div style={{ height:"2px", background:"rgba(255,255,255,0.06)", borderRadius:"2px", marginBottom:"12px", overflow:"hidden" }}>
        <div style={{ width:`${progress}%`, height:"100%", background:"linear-gradient(90deg, #C9A84C88, #C9A84C)", transition:"width 0.3s ease", borderRadius:"2px" }} />
      </div>

      {/* Final banner */}
      {isFinal && (
        <div style={{ marginBottom:"12px", textAlign:"center", background:"linear-gradient(135deg, #C9A84C18, #C9A84C08)", border:"1px solid #C9A84C44", borderRadius:"10px", padding:"12px" }}>
          <div style={{ fontSize:"18px", fontWeight:"800", color:"#C9A84C", letterSpacing:"2px" }}>🏆 FINAL STANDINGS</div>
          <div style={{ fontSize:"11px", color:"#6B7280", marginTop:"4px" }}>
            {rankings[0]?.[0]} leads with {rankings[0]?.[1]} pts!
          </div>
        </div>
      )}

      {/* Playback controls */}
      <div style={{ display:"flex", gap:"6px", justifyContent:"center", marginBottom:"8px", flexWrap:"wrap" }}>
        <button onClick={() => { stop(); setCurrentIdx(0) }} style={btnStyle("#1a1f2e")}>⏮</button>
        <button onClick={() => { stop(); setCurrentIdx(Math.max(0, currentIdx-1)) }} style={btnStyle("#1a1f2e")}>◀</button>
        {playing
          ? <button onClick={stop} style={btnStyle("#7B1C35","#e8e0d0")}>⏸ Pause</button>
          : <button onClick={() => { if(currentIdx>=snapshots.length-1) setCurrentIdx(0); setPlaying(true) }} style={btnStyle("#C9A84C","#0a0d12")}>▶ Play</button>
        }
        <button onClick={() => { stop(); setCurrentIdx(Math.min(snapshots.length-1, currentIdx+1)) }} style={btnStyle("#1a1f2e")}>▶</button>
        <button onClick={() => { stop(); setCurrentIdx(snapshots.length-1) }} style={btnStyle("#1a1f2e")}>⏭</button>
      </div>

      {/* Speed + players */}
      <div style={{ display:"flex", gap:"8px", justifyContent:"center", flexWrap:"wrap" }}>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
          style={{ background:"#1a1f2e", color:"#e8e0d0", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", padding:"5px 8px", fontSize:"11px" }}>
          <option value={2000}>🐢 Slow</option>
          <option value={1000}>Normal</option>
          <option value={500}>⚡ Fast</option>
          <option value={150}>🚀 Turbo</option>
        </select>
        <select value={topN} onChange={e => setTopN(Number(e.target.value))}
          style={{ background:"#1a1f2e", color:"#e8e0d0", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", padding:"5px 8px", fontSize:"11px" }}>
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
          <option value={15}>Top 15</option>
          <option value={25}>All 25 Players</option>
        </select>
      </div>
    </div>
  )
}
