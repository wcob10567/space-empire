import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Check, X, AlertTriangle, Sparkles, Pencil } from 'lucide-react'

const BLOCKED_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'cunt', 'dick', 'cock', 'pussy',
  'nigger', 'nigga', 'faggot', 'retard', 'nazi', 'hitler', 'rape',
  'porn', 'sex', 'nude', 'naked', 'kill', 'murder', 'suicide',
]

const NPC_NAMES = [
  'zorgath', 'nexus', 'iron dominion', 'void syndicate', 'solar federation',
  'dark matter guild', 'quantum reich', 'stellar horde', 'plasma covenant',
  'nova alliance', 'crimson fleet', 'shadow enclave', 'titan collective',
  'rust marauders', 'the singularity',
]

const RENAME_TOKEN_COST = 500

function validateName(name) {
  const trimmed = name.trim()
  if (trimmed.length < 3) return 'Name must be at least 3 characters.'
  if (trimmed.length > 24) return 'Name must be 24 characters or less.'
  if (!/^[a-zA-Z0-9 '\-]+$/.test(trimmed)) return 'Only letters, numbers, spaces, apostrophes and hyphens allowed.'
  if (/^\d+$/.test(trimmed)) return 'Name cannot be all numbers.'
  if (/\s{2,}/.test(trimmed)) return 'No double spaces allowed.'
  const lower = trimmed.toLowerCase()
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) return 'That name contains inappropriate content.'
  }
  for (const npc of NPC_NAMES) {
    if (lower.includes(npc)) return 'That name is too similar to an existing faction.'
  }
  return null
}

export default function RenamePlanet({ planet, profile, onRenamed, onProfileUpdate }) {
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmBuy, setConfirmBuy] = useState(false)
  const inputRef = useRef(null)

  const tokens = profile?.rename_tokens ?? 0
  const darkMatter = profile?.dark_matter ?? 0
  const canAffordToken = darkMatter >= RENAME_TOKEN_COST

  // Auto focus input when editing starts
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function handleStartEdit() {
    setNewName(planet?.name ?? '')
    setEditing(true)
    setError('')
    setConfirmBuy(false)
  }

  function handleCancel() {
    setEditing(false)
    setError('')
    setConfirmBuy(false)
  }

  function handleConfirmClick() {
    setError('')
    const trimmed = newName.trim()

    // If name didn't change, just close
    if (trimmed === planet?.name) { handleCancel(); return }

    const validationError = validateName(trimmed)
    if (validationError) { setError(validationError); return }

    if (tokens >= 1) {
      doRename(trimmed, false)
    } else {
      setConfirmBuy(true)
    }
  }

  async function handleConfirmBuyAndRename() {
    if (!canAffordToken) {
      setError(`Not enough Dark Matter. You need ${RENAME_TOKEN_COST} DM.`)
      return
    }
    await doRename(newName.trim(), true)
  }

  async function doRename(trimmed, buyToken) {
    setSaving(true)
    setError('')
    try {
      if (buyToken) {
        const { error: dmError } = await supabase
          .from('profiles')
          .update({ dark_matter: darkMatter - RENAME_TOKEN_COST })
          .eq('id', profile.id)
        if (dmError) throw dmError
      }

      const { error: planetError } = await supabase
        .from('planets')
        .update({ name: trimmed })
        .eq('id', planet.id)
      if (planetError) throw planetError

      const newTokenCount = buyToken ? tokens : tokens - 1
      const { error: tokenError } = await supabase
        .from('profiles')
        .update({ rename_tokens: newTokenCount })
        .eq('id', profile.id)
      if (tokenError) throw tokenError

      onProfileUpdate?.({
        ...profile,
        rename_tokens: newTokenCount,
        dark_matter: buyToken ? darkMatter - RENAME_TOKEN_COST : darkMatter,
      })

      onRenamed(trimmed)
      setEditing(false)
      setConfirmBuy(false)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Not editing: show planet name as clickable heading ──
  if (!editing) {
    return (
      <div className="group flex items-center gap-2 cursor-pointer w-fit" onClick={handleStartEdit}>
        <h2 className="text-2xl font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">
          {planet?.name ?? 'Loading...'}
        </h2>
        <Pencil
          size={14}
          className="text-gray-600 group-hover:text-cyan-400 transition-colors mt-1"
        />
      </div>
    )
  }

  // ── Editing: show inline input where the name was ──
  return (
    <div className="space-y-2">
      {/* Inline name input */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={e => { setNewName(e.target.value); setError(''); setConfirmBuy(false) }}
          onKeyDown={e => {
            if (e.key === 'Enter') handleConfirmClick()
            if (e.key === 'Escape') handleCancel()
          }}
          maxLength={24}
          className="text-2xl font-bold text-cyan-400 bg-transparent border-b-2 border-cyan-500 focus:outline-none w-full max-w-xs"
        />
        {/* Confirm */}
        <button
          onClick={handleConfirmClick}
          disabled={saving}
          className="text-green-400 hover:text-green-300 transition-colors"
          title="Confirm"
        >
          <Check size={20} />
        </button>
        {/* Cancel */}
        <button
          onClick={handleCancel}
          className="text-gray-500 hover:text-white transition-colors"
          title="Cancel"
        >
          <X size={20} />
        </button>
      </div>

      {/* Character count */}
      <p className="text-xs text-gray-600">{newName.length}/24</p>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-lg p-2 text-xs text-red-400">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      {/* Confirm buy popup — appears below input when no token */}
      {confirmBuy && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2">
          <p className="text-xs text-gray-300">
            No rename token. Rename to <span className="text-cyan-400 font-semibold">"{newName.trim()}"</span> for:
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-purple-400" />
              <span className="text-purple-400 font-bold text-sm">{RENAME_TOKEN_COST} Dark Matter</span>
            </div>
            <span className={`text-xs ${canAffordToken ? 'text-gray-500' : 'text-red-400'}`}>
              You have: {darkMatter.toLocaleString()} DM
            </span>
          </div>
          {!canAffordToken && (
            <p className="text-xs text-red-400">Not enough Dark Matter. Earn more by raiding NPCs!</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmBuy(false)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmBuyAndRename}
              disabled={!canAffordToken || saving}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                canAffordToken && !saving
                  ? 'bg-purple-700 hover:bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {saving ? 'Processing...' : 'Confirm & Rename'}
            </button>
          </div>
        </div>
      )}

      {/* Token info */}
      {!confirmBuy && (
        <p className="text-xs text-gray-600">
          {tokens > 0
            ? `${tokens} rename token${tokens !== 1 ? 's' : ''} available · Press Enter to confirm`
            : `Costs ${RENAME_TOKEN_COST} DM · Press Enter to confirm`}
        </p>
      )}
    </div>
  )
}