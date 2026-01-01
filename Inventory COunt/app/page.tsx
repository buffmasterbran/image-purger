'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Count } from '@/lib/supabase'
import { isValidSKU, getSimilarSKUs, VALID_SKUS } from '@/lib/valid-skus'
import toast, { Toaster } from 'react-hot-toast'

// Check authentication session
async function getSessionUser() {
  try {
    const response = await fetch('/api/auth/check')
    if (response.ok) {
      const data = await response.json()
      if (data.authenticated) {
        return data.user
      }
    }
  } catch (error) {
    console.error('Error checking session:', error)
  }
  return null
}

// Item Editor Component
function ItemEditor({ item, onUpdate, onDelete }: { item: Count; onUpdate: (item: Count, data: any) => Promise<void>; onDelete: (id: number | undefined) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [editSku, setEditSku] = useState(item.sku)
  const [editSize, setEditSize] = useState<'16/10oz' | '26oz'>(item.size)
  const [editPallets, setEditPallets] = useState(item.pallets.toString())
  const [editCartons, setEditCartons] = useState(item.cartons.toString())
  const [editUnits, setEditUnits] = useState(item.units.toString())

  const handleSave = async () => {
    // Validate SKU before saving
    const upperSku = editSku.trim().toUpperCase()
    if (!isValidSKU(upperSku)) {
      const similar = getSimilarSKUs(upperSku)
      if (similar.length > 0) {
        toast.error(`That SKU doesn't exist. Did you mean: ${similar.join(', ')}?`, {
          duration: 5000,
        })
      } else {
        toast.error("That SKU doesn't exist. Please check your SKU and try again.")
      }
      return
    }
    
    await onUpdate(item, {
      sku: upperSku,
      size: editSize,
      pallets: parseInt(editPallets) || 0,
      cartons: parseInt(editCartons) || 0,
      units: parseInt(editUnits) || 0,
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setEditSku(item.sku)
    setEditSize(item.size)
    setEditPallets(item.pallets.toString())
    setEditCartons(item.cartons.toString())
    setEditUnits(item.units.toString())
    setEditing(false)
  }

  const cartonsPerPallet = item.size === '26oz' ? 24 : 32
  const totalUnits = (item.pallets * cartonsPerPallet * 24) + (item.cartons * 24) + item.units

  if (editing) {
    return (
      <div className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50">
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium mb-1">SKU</label>
            <input
              type="text"
              value={editSku}
              onChange={(e) => setEditSku(e.target.value.toUpperCase())}
              className="w-full px-2 py-1 text-base border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Size</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditSize('16/10oz')}
                className={`flex-1 py-1 text-sm font-semibold rounded border-2 ${
                  editSize === '16/10oz'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-300'
                }`}
              >
                16/10oz
              </button>
              <button
                type="button"
                onClick={() => setEditSize('26oz')}
                className={`flex-1 py-1 text-sm font-semibold rounded border-2 ${
                  editSize === '26oz'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-300'
                }`}
              >
                26oz
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Pallets</label>
              <input
                type="number"
                value={editPallets}
                onChange={(e) => setEditPallets(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cartons</label>
              <input
                type="number"
                value={editCartons}
                onChange={(e) => setEditCartons(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Units</label>
              <input
                type="number"
                value={editUnits}
                onChange={(e) => setEditUnits(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                min="0"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-green-600 text-white py-2 text-sm font-semibold rounded hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-600 text-white py-2 text-sm font-semibold rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-300 rounded-lg p-3 bg-white">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="font-semibold text-lg">{item.sku}</div>
          <div className="text-sm text-gray-600">Size: {item.size}</div>
          <div className="text-sm text-gray-600 mt-1">
            P: {item.pallets} | C: {item.cartons} | U: {item.units}
          </div>
          <div className="text-sm font-semibold text-blue-600 mt-1">
            Total: {totalUnits.toLocaleString()} units
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="bg-blue-600 text-white px-3 py-1 text-sm font-semibold rounded hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="bg-red-600 text-white px-3 py-1 text-sm font-semibold rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CounterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [isCountingAlone, setIsCountingAlone] = useState<boolean | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sku, setSku] = useState('')
  const [size, setSize] = useState<'16/10oz' | '26oz'>('16/10oz')
  const [pallets, setPallets] = useState('')
  const [cartons, setCartons] = useState('')
  const [units, setUnits] = useState('')
  const [lastSubmittedItem, setLastSubmittedItem] = useState<Count | null>(null)
  const [showLastItemDialog, setShowLastItemDialog] = useState(false)
  const [allSubmittedItems, setAllSubmittedItems] = useState<Count[]>([])
  const [showAllItemsDialog, setShowAllItemsDialog] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [otherParticipants, setOtherParticipants] = useState<string[]>([])
  const [showSessionDialog, setShowSessionDialog] = useState(false)
  const [availableSessions, setAvailableSessions] = useState<any[]>([])
  const [showSessionNameDialog, setShowSessionNameDialog] = useState(false)
  const [selectedSessionName, setSelectedSessionName] = useState('')
  const [sessionNameDialogFromExisting, setSessionNameDialogFromExisting] = useState(false)
  const [skuSuggestions, setSkuSuggestions] = useState<string[]>([])
  const [showSkuSuggestions, setShowSkuSuggestions] = useState(false)
  const skuInputRef = useRef<HTMLInputElement>(null)
  const skuSuggestionsRef = useRef<HTMLDivElement>(null)

  const SESSION_NAME_OPTIONS = [
    'Active WHS',
    'Active DTC',
    'E-COM',
    'Unit 309',
    'Unit 510',
    'Unit 525 Pallets',
  ]

  useEffect(() => {
    // Check authentication and auto-fill name
    const checkAuthAndLoad = async () => {
      const sessionUser = await getSessionUser()
      
      if (sessionUser) {
        // User is authenticated - use their full name if available, otherwise username
        setIsAuthenticated(true)
        setIsAdmin(sessionUser.isAdmin || false)
        const authenticatedName = sessionUser.fullName || sessionUser.username
        setName(authenticatedName)
        localStorage.setItem('counter_name', authenticatedName)
        
        // Check if they have an existing counting session
        const storedCountingAlone = localStorage.getItem('counting_alone')
        const storedSessionId = localStorage.getItem('current_session_id')
        
        if (storedCountingAlone === 'true' || storedSessionId) {
          setIsCountingAlone(storedCountingAlone === 'true')
          setIsLoggedIn(true)
          if (storedSessionId) {
            setSessionId(storedSessionId)
            fetchSessionParticipants(storedSessionId, authenticatedName)
          }
          initializeCounter(authenticatedName)
          setTimeout(() => {
            fetchAllItems()
          }, 200)
        }
      } else {
        // Not authenticated - check for stored session (backward compatibility)
        const storedName = localStorage.getItem('counter_name')
        const storedCountingAlone = localStorage.getItem('counting_alone')
        const storedSessionId = localStorage.getItem('current_session_id')
        
        if (storedName && (storedCountingAlone === 'true' || storedSessionId)) {
          setName(storedName)
          setIsCountingAlone(storedCountingAlone === 'true')
          setIsLoggedIn(true)
          if (storedSessionId) {
            setSessionId(storedSessionId)
            fetchSessionParticipants(storedSessionId, storedName)
          }
          initializeCounter(storedName)
          setTimeout(() => {
            fetchAllItems()
          }, 200)
        }
      }
    }
    
    checkAuthAndLoad()
  }, [])

  const fetchSessionParticipants = async (sessionId: string, currentName: string) => {
    const { data } = await supabase
      .from('count_sessions')
      .select('participants')
      .eq('session_id', sessionId)
      .single()
    
    if (data?.participants) {
      const others = data.participants.filter((p: string) => p !== currentName)
      setOtherParticipants(others)
      
      // Subscribe to session changes
      if (typeof window !== 'undefined') {
        const sessionChannel = supabase
          .channel(`session_${sessionId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'count_sessions',
              filter: `session_id=eq.${sessionId}`,
            },
            (payload) => {
              const session = payload.new as any
              if (session.participants) {
                const others = session.participants.filter((p: string) => p !== currentName)
                setOtherParticipants(others)
              }
            }
          )
          .subscribe()
      }
    }
  }

  useEffect(() => {
    if (isLoggedIn && skuInputRef.current) {
      skuInputRef.current.focus()
    }
  }, [isLoggedIn])

  const initializeCounter = async (counterName: string) => {
    const { error } = await supabase
      .from('counter_status')
      .upsert(
        {
          name: counterName,
          is_finished: false,
        },
        {
          onConflict: 'name',
        }
      )

    if (error) {
      console.error('Error initializing counter:', error)
      toast.error('Failed to initialize counter')
    }
  }

  const handleCountingMode = (alone: boolean) => {
    setIsCountingAlone(alone)
    localStorage.setItem('counting_alone', alone.toString())
  }

  const generateSessionId = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Please enter your name')
      return
    }

    if (isCountingAlone === null) {
      toast.error('Please select if you are counting alone or with others')
      return
    }

    await initializeCounter(name.trim())
    
    // If counting with others, find existing session or create new one
    if (!isCountingAlone) {
      // Find all existing pending sessions from the last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      sevenDaysAgo.setHours(0, 0, 0, 0)
      
      // Find all pending sessions, but also include recently created sessions that might be joinable
      const { data: existingSessions, error: sessionsError } = await supabase
        .from('count_sessions')
        .select('*')
        .eq('status', 'pending')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })

      // If no pending sessions, check for any recent sessions that aren't finalized or combined
      let sessionsToShow = existingSessions || []
      if (sessionsToShow.length === 0) {
        // First, get ALL recent sessions to see what we have
        const { data: allSessionsDebug } = await supabase
          .from('count_sessions')
          .select('*')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
        
        console.log('All recent sessions (for debugging):', allSessionsDebug)
        if (allSessionsDebug && allSessionsDebug.length > 0) {
          allSessionsDebug.forEach((s: any) => {
            console.log(`Session ${s.session_id}: status="${s.status}", participants=${JSON.stringify(s.participants)}`)
          })
        }
        
        // Now get joinable sessions (not finalized or combined)
        const { data: allRecentSessions } = await supabase
          .from('count_sessions')
          .select('*')
          .gte('created_at', sevenDaysAgo.toISOString())
          .not('status', 'eq', 'finalized') // Exclude finalized
          .not('status', 'eq', 'combined') // Exclude combined
          .order('created_at', { ascending: false })
        
        if (allRecentSessions && allRecentSessions.length > 0) {
          sessionsToShow = allRecentSessions
          console.log('No pending sessions, but found recent joinable sessions:', allRecentSessions)
        }
      }
      
      console.log('Sessions to show:', sessionsToShow?.length, sessionsToShow)
      
      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError)
        toast.error('Failed to fetch sessions')
      }

      if (sessionsToShow && sessionsToShow.length > 0) {
        // Sessions available - show dialog to select or create new
        console.log('Sessions found, showing dialog')
        setAvailableSessions(sessionsToShow)
        setShowSessionDialog(true)
        return // Don't log in yet, wait for user to select session
      } else {
        // No sessions - show dialog to select session name first
        setShowSessionNameDialog(true)
        return // Don't log in yet, wait for user to select session name
      }
    }
    
    localStorage.setItem('counter_name', name.trim())
    setIsLoggedIn(true)
    toast.success(`Welcome, ${name.trim()}!`)
  }

  const joinSession = async (sessionIdToUse: string, sessionToUpdate: any, userName: string) => {
    setSessionId(sessionIdToUse)
    localStorage.setItem('current_session_id', sessionIdToUse)

    // Add participant to existing session
    const updatedParticipants = [...(sessionToUpdate.participants || []), userName]
    const uniqueParticipants = Array.from(new Set(updatedParticipants))
    await supabase
      .from('count_sessions')
      .update({ participants: uniqueParticipants })
      .eq('session_id', sessionIdToUse)
    
    // Show other participants
    const others = uniqueParticipants.filter(p => p !== userName)
    setOtherParticipants(others)
    
    // Subscribe to session changes to see when others join
    if (typeof window !== 'undefined') {
      const sessionChannel = supabase
        .channel(`session_${sessionIdToUse}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'count_sessions',
            filter: `session_id=eq.${sessionIdToUse}`,
          },
          (payload) => {
            const session = payload.new as any
            if (session.participants) {
              const others = session.participants.filter((p: string) => p !== userName)
              setOtherParticipants(others)
            }
          }
        )
        .subscribe()
    }
  }

  const createNewSession = async (userName: string, sessionName?: string) => {
    const sessionIdToUse = generateSessionId()
    setSessionId(sessionIdToUse)
    localStorage.setItem('current_session_id', sessionIdToUse)

    // Create new session with optional session name
    const sessionData: any = {
      session_id: sessionIdToUse,
      participants: [userName],
      status: 'pending',
    }
    
    // Add session_name if provided (only if column exists in database)
    if (sessionName) {
      sessionData.session_name = sessionName
    }

    const { data, error } = await supabase
      .from('count_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      // If session_name column doesn't exist, try without it
      const isSessionNameError = error.message?.includes('session_name') || 
                                 error.code === 'PGRST204' && sessionName
      
      if (isSessionNameError && sessionName) {
        console.log('session_name column not found, retrying without it...')
        const { data: retryData, error: retryError } = await supabase
          .from('count_sessions')
          .insert({
            session_id: sessionIdToUse,
            participants: [userName],
            status: 'pending',
          })
          .select()
          .single()
        
        if (retryError) {
          console.error('Error creating session (retry):', retryError)
          toast.error(`Failed to create session: ${retryError.message}`)
          return
        }
        console.log('Session created successfully (without session_name):', retryData)
        // Successfully created without session_name - no error to show
        return // Exit early since we successfully created the session
      } else {
        // Only show error if it's not a session_name column issue
        toast.error(`Failed to create session: ${error.message}`)
        return
      }
    } else {
      console.log('Session created successfully:', data)
    }
    
    setOtherParticipants([])
    
    // Subscribe to session changes
    if (typeof window !== 'undefined') {
      const sessionChannel = supabase
        .channel(`session_${sessionIdToUse}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'count_sessions',
            filter: `session_id=eq.${sessionIdToUse}`,
          },
          (payload) => {
            const session = payload.new as any
            if (session.participants) {
              const others = session.participants.filter((p: string) => p !== userName)
              setOtherParticipants(others)
            }
          }
        )
        .subscribe()
    }
  }

  const handleSelectSession = async (selectedSession: any) => {
    const userName = name.trim()
    await joinSession(selectedSession.session_id, selectedSession, userName)
    setShowSessionDialog(false)
    setAvailableSessions([])
    localStorage.setItem('counter_name', userName)
    setIsLoggedIn(true)
    toast.success(`Welcome, ${userName}! Joined session with ${selectedSession.participants?.join(', ') || 'others'}`)
  }

  const handleCreateNewSession = async () => {
    const userName = name.trim()
    await createNewSession(userName, selectedSessionName || undefined)
    setShowSessionDialog(false)
    setShowSessionNameDialog(false)
    setAvailableSessions([])
    setSelectedSessionName('')
    localStorage.setItem('counter_name', userName)
    setIsLoggedIn(true)
    toast.success(`Welcome, ${userName}! Created new counting session${selectedSessionName ? `: ${selectedSessionName}` : ''}.`)
  }

  const handleConfirmSessionName = async () => {
    if (!selectedSessionName.trim()) {
      toast.error('Please select a session name')
      return
    }
    const userName = name.trim()
    await createNewSession(userName, selectedSessionName)
    setShowSessionNameDialog(false)
    setSessionNameDialogFromExisting(false)
    setSelectedSessionName('')
    localStorage.setItem('counter_name', userName)
    setIsLoggedIn(true)
    toast.success(`Welcome, ${userName}! Created new counting session: ${selectedSessionName}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sku.trim()) {
      toast.error('Please enter a SKU')
      return
    }

    // Validate SKU
    const upperSku = sku.trim().toUpperCase()
    if (!isValidSKU(upperSku)) {
      const similar = getSimilarSKUs(upperSku)
      if (similar.length > 0) {
        toast.error(`That SKU doesn't exist. Did you mean: ${similar.join(', ')}?`, {
          duration: 5000,
        })
      } else {
        toast.error("That SKU doesn't exist. Please check your SKU and try again.")
      }
      return
    }

    // Build count data - start with required fields only
    const countData: any = {
      counter_name: name.trim(),
      sku: upperSku,
      size,
      pallets: parseInt(pallets) || 0,
      cartons: parseInt(cartons) || 0,
      units: parseInt(units) || 0,
    }
    
    // Only add session_id if counting with others
    // Check both state and localStorage to be safe
    const countingAlone = isCountingAlone !== null 
      ? isCountingAlone 
      : localStorage.getItem('counting_alone') === 'true'
    
    if (!countingAlone) {
      const currentSessionId = sessionId || localStorage.getItem('current_session_id')
      if (currentSessionId) {
        // Only add session_id if column exists (will fail gracefully if it doesn't)
        countData.session_id = currentSessionId
      }
    }

    const { data, error } = await supabase.from('counts').insert(countData).select().single()

    if (error) {
      console.error('Error saving count:', error)
      console.error('Error details:', error.message, error.details, error.hint)
      
      // If error is about session_id column, provide helpful message
      if (error.message?.includes('session_id') || error.message?.includes('column')) {
        toast.error('Database migration needed! Please run the SQL in database_updates.sql')
      } else {
        toast.error(`Failed to save count: ${error.message}`)
      }
      return
    }

    // Store the last submitted item
    if (data) {
      setLastSubmittedItem(data)
      // Refresh all items list
      await fetchAllItems()
    }

    toast.success('Count saved!')
    setSku('')
    setPallets('')
    setCartons('')
    setUnits('')
    setSize('16/10oz')
    
    // Refocus on SKU input
    setTimeout(() => {
      skuInputRef.current?.focus()
    }, 100)
  }

  const fetchAllItems = async () => {
    try {
      const currentName = name.trim() || localStorage.getItem('counter_name') || ''
      if (!currentName) {
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const countingAlone = isCountingAlone !== null 
        ? isCountingAlone 
        : localStorage.getItem('counting_alone') === 'true'
      
      let query = supabase
        .from('counts')
        .select('*')
        .eq('counter_name', currentName)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('created_at', { ascending: false })

      if (!countingAlone) {
        const currentSessionId = sessionId || localStorage.getItem('current_session_id')
        if (currentSessionId) {
          query = query.eq('session_id', currentSessionId)
        }
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching items:', error)
        return
      }

      setAllSubmittedItems(data || [])
    } catch (error) {
      console.error('Error in fetchAllItems:', error)
    }
  }

  const handleDeleteLastItem = async () => {
    if (!lastSubmittedItem?.id) {
      toast.error('No item to delete')
      return
    }

    const { error } = await supabase
      .from('counts')
      .delete()
      .eq('id', lastSubmittedItem.id)

    if (error) {
      console.error('Error deleting count:', error)
      toast.error('Failed to delete item')
      return
    }

    toast.success('Last item deleted!')
    setLastSubmittedItem(null)
    setShowLastItemDialog(false)
  }

  const handleKeepLastItem = () => {
    setShowLastItemDialog(false)
  }

  const handleDeleteItem = async (itemId: number | undefined) => {
    if (!itemId) {
      toast.error('Invalid item ID')
      return
    }

    if (!confirm('Are you sure you want to delete this item?')) {
      return
    }

    const { error } = await supabase
      .from('counts')
      .delete()
      .eq('id', itemId)

    if (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
      return
    }

    toast.success('Item deleted!')
    await fetchAllItems()
    
    // Update last submitted item if it was deleted
    if (lastSubmittedItem?.id === itemId) {
      setLastSubmittedItem(null)
    }
  }

  const handleUpdateItem = async (item: Count, updatedData: { sku?: string; size?: string; pallets?: number; cartons?: number; units?: number }) => {
    try {
      const newSku = updatedData.sku?.trim().toUpperCase() || item.sku
      const newSize = updatedData.size || item.size
      
      // Check if changing to a SKU that already exists (same SKU + size)
      const existingItem = allSubmittedItems.find(
        i => i.id !== item.id && 
        i.sku.toUpperCase() === newSku && 
        i.size === newSize
      )

      if (existingItem) {
        // Merge: add quantities together
        const mergedPallets = (existingItem.pallets || 0) + (updatedData.pallets ?? item.pallets)
        const mergedCartons = (existingItem.cartons || 0) + (updatedData.cartons ?? item.cartons)
        const mergedUnits = (existingItem.units || 0) + (updatedData.units ?? item.units)

        // Update the existing item with merged quantities
        const { error: updateError } = await supabase
          .from('counts')
          .update({
            pallets: mergedPallets,
            cartons: mergedCartons,
            units: mergedUnits,
          })
          .eq('id', existingItem.id)

        if (updateError) {
          console.error('Error updating merged item:', updateError)
          toast.error('Failed to merge items')
          return
        }

        // Delete the item being edited
        const { error: deleteError } = await supabase
          .from('counts')
          .delete()
          .eq('id', item.id)

        if (deleteError) {
          console.error('Error deleting merged item:', deleteError)
          toast.error('Failed to complete merge')
          return
        }

        toast.success('Items merged successfully!')
      } else {
        // Just update the item
        const { error } = await supabase
          .from('counts')
          .update({
            sku: newSku,
            size: newSize,
            pallets: updatedData.pallets ?? item.pallets,
            cartons: updatedData.cartons ?? item.cartons,
            units: updatedData.units ?? item.units,
          })
          .eq('id', item.id)

        if (error) {
          console.error('Error updating item:', error)
          toast.error('Failed to update item')
          return
        }

        toast.success('Item updated!')
      }

      await fetchAllItems()
      
      // Update last submitted item if it was the one edited
      if (lastSubmittedItem?.id === item.id) {
        if (existingItem) {
          // Item was merged, clear last submitted
          setLastSubmittedItem(null)
        } else {
          // Item was updated, refresh it
          const { data } = await supabase
            .from('counts')
            .select('*')
            .eq('id', item.id)
            .single()
          if (data) {
            setLastSubmittedItem(data)
          }
        }
      }
    } catch (error) {
      console.error('Error in handleUpdateItem:', error)
      toast.error('Failed to update item')
    }
  }

  const handleFinish = async () => {
    if (!confirm('Are you sure you are finished counting? This will mark you as complete.')) {
      return
    }

    const { error } = await supabase
      .from('counter_status')
      .update({ is_finished: true })
      .eq('name', name.trim())

    if (error) {
      console.error('Error marking finished:', error)
      toast.error('Failed to mark as finished')
      return
    }

    // If counting alone, create/update count_sessions record and mark as finalized
    if (isCountingAlone) {
      const currentSessionId = sessionId || localStorage.getItem('current_session_id')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Get all counts for this counter from today
      const { data: countsData } = await supabase
        .from('counts')
        .select('*')
        .eq('counter_name', name.trim())
        .gte('created_at', today.toISOString())
      
      if (countsData && countsData.length > 0) {
        // Use session_id from first count if available, or generate one
        const sessionIdToUse = currentSessionId || countsData[0].session_id || generateSessionId()
        
        // Update all counts to have this session_id if they don't have one
        if (!currentSessionId && !countsData[0].session_id) {
          await supabase
            .from('counts')
            .update({ session_id: sessionIdToUse })
            .eq('counter_name', name.trim())
            .gte('created_at', today.toISOString())
        }
        
        // Create or update count_sessions record
        const { data: existingSession } = await supabase
          .from('count_sessions')
          .select('*')
          .eq('session_id', sessionIdToUse)
          .single()
        
        if (existingSession) {
          // Update existing session to finalized
          await supabase
            .from('count_sessions')
            .update({
              status: 'finalized',
              finalized_at: new Date().toISOString(),
            })
            .eq('session_id', sessionIdToUse)
        } else {
          // Create new session record marked as finalized
          await supabase
            .from('count_sessions')
            .insert({
              session_id: sessionIdToUse,
              participants: [name.trim()],
              status: 'finalized',
              finalized_at: new Date().toISOString(),
            })
        }
      }
      
      router.push('/results')
    } else {
      router.push('/waiting')
    }
  }

  const handleLeaveSession = async () => {
    const currentSessionId = sessionId || localStorage.getItem('current_session_id')
    const currentName = name.trim()
    
    if (!confirm('Are you sure you want to leave this session? You can rejoin later if the session is still active.')) {
      return
    }

    // If there's a session, check if we should delete it or just remove the user
    if (currentSessionId && !isCountingAlone) {
      try {
        // Fetch the current session to check participants
        const { data: sessionData, error: sessionError } = await supabase
          .from('count_sessions')
          .select('*')
          .eq('session_id', currentSessionId)
          .single()

        if (!sessionError && sessionData) {
          const participants = sessionData.participants || []
          const isOnlyParticipant = participants.length === 1 && participants[0] === currentName
          
          if (isOnlyParticipant) {
            // User is the only participant - delete the session and all associated counts
            console.log('User is only participant, deleting session...')
            
            // Delete all counts for this session
            const { error: countsError } = await supabase
              .from('counts')
              .delete()
              .eq('session_id', currentSessionId)

            if (countsError) {
              console.error('Error deleting counts:', countsError)
            }

            // Delete the session
            const { error: deleteError } = await supabase
              .from('count_sessions')
              .delete()
              .eq('session_id', currentSessionId)

            if (deleteError) {
              console.error('Error deleting session:', deleteError)
              toast.error('Failed to delete session')
            } else {
              toast.success('Session deleted (you were the only participant)')
            }
          } else {
            // Remove user from participants list
            const updatedParticipants = participants.filter((p: string) => p !== currentName)
            const { error: updateError } = await supabase
              .from('count_sessions')
              .update({ participants: updatedParticipants })
              .eq('session_id', currentSessionId)

            if (updateError) {
              console.error('Error updating participants:', updateError)
              toast.error('Failed to leave session')
            } else {
              toast.success('Left session successfully')
            }
          }
        }
      } catch (error) {
        console.error('Error in handleLeaveSession:', error)
        toast.error('Failed to leave session')
      }
    }

    // Clear session data so user can choose solo or multi-person for next count
    localStorage.removeItem('current_session_id')
    localStorage.removeItem('counting_alone')
    // Keep counter_name so they don't have to re-enter it
    // Use window.location.href to force a full page reload and reset component state
    window.location.href = '/'
  }

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to log out? You will need to log in again to continue counting.')) {
      return
    }

    // Clear all localStorage
    localStorage.removeItem('counter_name')
    localStorage.removeItem('counting_alone')
    localStorage.removeItem('current_session_id')
    
    // Reset counter status
    try {
      await supabase
        .from('counter_status')
        .update({ is_finished: false })
        .eq('name', name.trim())
    } catch (error) {
      // Even if update fails, still log out
      console.error('Error resetting counter status:', error)
    }
    
    toast.success('Logged out!')
    
    // Use window.location for a hard redirect to ensure state is reset
    window.location.href = '/'
  }

  const increment = (field: 'pallets' | 'cartons' | 'units') => {
    const current = parseInt(field === 'pallets' ? pallets : field === 'cartons' ? cartons : units) || 0
    const newValue = (current + 1).toString()
    if (field === 'pallets') setPallets(newValue)
    else if (field === 'cartons') setCartons(newValue)
    else setUnits(newValue)
  }

  const decrement = (field: 'pallets' | 'cartons' | 'units') => {
    if (field === 'pallets') {
      // Pallets remain independent - just decrement by 1
      const current = parseInt(pallets) || 0
      const newValue = Math.max(0, current - 1).toString()
      setPallets(newValue)
    } else if (field === 'cartons') {
      const current = parseInt(cartons) || 0
      const cartonsPerPallet = size === '26oz' ? 24 : 32
      
      // If at 0, cycle to max-1 (so clicking once gives you the most common partial count)
      // Otherwise, decrement by 1
      if (current === 0) {
        setCartons((cartonsPerPallet - 1).toString())
      } else {
        const newValue = (current - 1).toString()
        setCartons(newValue)
      }
    } else if (field === 'units') {
      const current = parseInt(units) || 0
      const unitsPerCarton = 24
      
      // If at 0, cycle to max-1 (23, so clicking once gives you the most common partial count)
      // Otherwise, decrement by 1
      if (current === 0) {
        setUnits((unitsPerCarton - 1).toString())
      } else {
        const newValue = (current - 1).toString()
        setUnits(newValue)
      }
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-2">
        <Toaster />
        <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-xl">
          <h1 className="text-2xl font-bold text-center mb-4 text-gray-900">Inventory Counter</h1>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="name" className="block text-base font-medium text-gray-900">
                  User
                </label>
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch('/api/auth/logout', { method: 'POST' })
                      localStorage.removeItem('counter_name')
                      localStorage.removeItem('counting_alone')
                      localStorage.removeItem('current_session_id')
                      router.push('/login')
                    }}
                    className="bg-red-600 text-white px-4 py-1.5 text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Logout
                  </button>
                )}
              </div>
              {isAuthenticated ? (
                <div className="w-full px-4 py-3 text-lg text-gray-900 font-semibold bg-gray-50 rounded-lg border border-gray-200">
                  {name}
                </div>
              ) : (
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Enter your name"
                  autoFocus
                />
              )}
            </div>
            
            <div>
              <label className="block text-base font-medium mb-2 text-gray-900">
                Are you counting alone today?
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleCountingMode(true)}
                  className={`flex-1 py-3 text-lg font-semibold rounded-lg border-2 transition-colors ${
                    isCountingAlone === true
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  Yes, Alone
                </button>
                <button
                  type="button"
                  onClick={() => handleCountingMode(false)}
                  className={`flex-1 py-3 text-lg font-semibold rounded-lg border-2 transition-colors ${
                    isCountingAlone === false
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  With Others
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!name.trim() || isCountingAlone === null}
              className="w-full bg-blue-600 text-white py-3 text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Start Counting
            </button>
          </form>
          
          {isAdmin && (
            <div className="mt-3 pt-3 border-t-2 border-gray-200 space-y-2">
              <button
                onClick={() => router.push('/history')}
                className="w-full bg-gray-600 text-white py-2 text-base font-semibold rounded-lg hover:bg-gray-700 transition-colors"
              >
                See Previous Counts
              </button>
              <button
                onClick={() => router.push('/active-sessions')}
                className="w-full bg-purple-600 text-white py-2 text-base font-semibold rounded-lg hover:bg-purple-700 transition-colors"
              >
                See Active Sessions
              </button>
            </div>
          )}
        </div>

        {/* Session Name Selection Dialog */}
        {showSessionNameDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-center mb-4 text-gray-900">Name Your Session</h2>
                <p className="text-base text-gray-700 mb-4 text-center">
                  Select a name for this counting session
                </p>
                
                <div className="space-y-2 mb-6">
                  {SESSION_NAME_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => setSelectedSessionName(option)}
                      className={`w-full p-4 text-left border-2 rounded-lg transition-colors ${
                        selectedSessionName === option
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      <p className="text-lg font-semibold">{option}</p>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSessionNameDialog(false)
                      setSelectedSessionName('')
                      // If opened from existing sessions dialog, return to it
                      if (sessionNameDialogFromExisting) {
                        setSessionNameDialogFromExisting(false)
                        setShowSessionDialog(true)
                      }
                    }}
                    className="flex-1 bg-gray-600 text-white py-3 text-lg font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSessionName}
                    disabled={!selectedSessionName.trim()}
                    className="flex-1 bg-blue-600 text-white py-3 text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Start Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Selection Dialog */}
        {showSessionDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4">
                <h2 className="text-xl font-bold text-center mb-3 text-gray-900">Select Counting Session</h2>
                <p className="text-base text-gray-700 mb-3 text-center">
                  {availableSessions.length > 1 
                    ? 'Multiple counting sessions are active. Which session would you like to join?'
                    : 'A counting session is already active. Would you like to join it or start a new one?'}
                </p>
                
                <div className="space-y-2 mb-3">
                  {availableSessions.map((session, index) => {
                    const sessionDate = new Date(session.created_at)
                    const timeStr = sessionDate.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })
                    return (
                      <button
                        key={session.session_id}
                        onClick={() => handleSelectSession(session)}
                        className="w-full p-3 text-left border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-base font-semibold text-gray-900 mb-1">
                              Session {index + 1}
                            </p>
                            <p className="text-sm text-gray-700">
                              <span className="font-semibold">Participants:</span>{' '}
                              {session.participants?.length > 0 
                                ? session.participants.join(', ')
                                : 'None yet'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Started at {timeStr}
                            </p>
                          </div>
                          <div className="text-lg text-blue-600">→</div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setSessionNameDialogFromExisting(true)
                      setShowSessionDialog(false)
                      setShowSessionNameDialog(true)
                    }}
                    className="w-full bg-gray-600 text-white py-2 text-base font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Create New Session
                  </button>
                  <button
                    onClick={() => {
                      setShowSessionDialog(false)
                      setAvailableSessions([])
                    }}
                    className="w-full bg-red-600 text-white py-2 text-base font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster />
      <div className="flex-1 container mx-auto px-4 py-2 max-w-7xl">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold">Counter: {name}</h1>
            {!isCountingAlone && otherParticipants.length > 0 && (
              <p className="text-sm text-gray-600">
                Counting with: {otherParticipants.join(', ')}
              </p>
            )}
            {!isCountingAlone && otherParticipants.length === 0 && (
              <p className="text-sm text-gray-500 italic">
                Waiting for others to join...
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await fetchAllItems()
                setShowAllItemsDialog(true)
              }}
              className="bg-blue-600 text-white px-3 py-2 text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              View ALL Items
            </button>
            <button
              onClick={handleLeaveSession}
              className="bg-gray-600 text-white px-3 py-2 text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors"
            >
              Leave Session
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-3 mb-3">
          <div className="space-y-3">
            {/* SKU Input */}
            <div className="relative">
              <label htmlFor="sku" className="block text-sm font-medium mb-1">
                SKU
              </label>
              <input
                ref={skuInputRef}
                id="sku"
                type="text"
                value={sku}
                onChange={(e) => {
                  const newSku = e.target.value.toUpperCase()
                  setSku(newSku)
                  
                  // Show autocomplete suggestions after 3 characters
                  if (newSku.length >= 3) {
                    const filtered = VALID_SKUS.filter(validSku =>
                      validSku.toUpperCase().startsWith(newSku)
                    ).slice(0, 10) // Limit to 10 suggestions
                    setSkuSuggestions(filtered)
                    setShowSkuSuggestions(filtered.length > 0 && newSku.length < filtered[0].length)
                  } else {
                    setSkuSuggestions([])
                    setShowSkuSuggestions(false)
                  }
                  
                  // Auto-select size based on SKU pattern
                  // DPT or WPT followed by 10 or 16 → 16/10oz
                  // DPT or WPT followed by 26 → 26oz
                  if (newSku.match(/^(DPT|WPT).*(10|16)/i)) {
                    setSize('16/10oz')
                  } else if (newSku.match(/^(DPT|WPT).*26/i)) {
                    setSize('26oz')
                  }
                }}
                onFocus={() => {
                  // Show suggestions when input is focused if we have 3+ characters
                  if (sku.length >= 3 && skuSuggestions.length > 0) {
                    setShowSkuSuggestions(true)
                  }
                }}
                onBlur={() => {
                  // Hide suggestions when input loses focus (with small delay to allow clicks)
                  setTimeout(() => setShowSkuSuggestions(false), 200)
                }}
                className="w-full px-3 py-2 text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="Enter SKU"
                autoFocus
              />
              {/* SKU Suggestions Dropdown */}
              {showSkuSuggestions && skuSuggestions.length > 0 && (
                <div
                  ref={skuSuggestionsRef}
                  className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  {skuSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setSku(suggestion)
                        setShowSkuSuggestions(false)
                        // Auto-select size based on SKU pattern
                        if (suggestion.match(/^(DPT|WPT).*(10|16)/i)) {
                          setSize('16/10oz')
                        } else if (suggestion.match(/^(DPT|WPT).*26/i)) {
                          setSize('26oz')
                        }
                        // Refocus on SKU input after selection
                        setTimeout(() => {
                          skuInputRef.current?.focus()
                        }, 100)
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 hover:text-blue-900 focus:bg-blue-50 focus:text-blue-900 focus:outline-none border-b border-gray-200 last:border-b-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Size Toggles */}
            <div>
              <label className="block text-sm font-medium mb-1">Size</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSize('16/10oz')}
                  className={`flex-1 py-2 text-base font-semibold rounded-lg border-2 transition-colors ${
                    size === '16/10oz'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  16/10oz
                </button>
                <button
                  type="button"
                  onClick={() => setSize('26oz')}
                  className={`flex-1 py-2 text-base font-semibold rounded-lg border-2 transition-colors ${
                    size === '26oz'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
                >
                  26oz
                </button>
              </div>
            </div>

            {/* Quantity Inputs */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="pallets" className="block text-sm font-medium mb-1">
                  Pallets
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => decrement('pallets')}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold text-2xl w-12 h-12 rounded-lg transition-colors active:bg-red-700 shadow flex items-center justify-center"
                  >
                    −
                  </button>
                  <input
                    id="pallets"
                    type="number"
                    value={pallets}
                    onChange={(e) => setPallets(e.target.value)}
                    className="w-16 px-2 py-2 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center h-12"
                    placeholder="0"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => increment('pallets')}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold text-2xl w-12 h-12 rounded-lg transition-colors active:bg-green-700 shadow flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="cartons" className="block text-sm font-medium mb-1">
                  Cartons
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => decrement('cartons')}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold text-2xl w-12 h-12 rounded-lg transition-colors active:bg-red-700 shadow flex items-center justify-center"
                  >
                    −
                  </button>
                  <input
                    id="cartons"
                    type="number"
                    value={cartons}
                    onChange={(e) => setCartons(e.target.value)}
                    className="w-16 px-2 py-2 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center h-12"
                    placeholder="0"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => increment('cartons')}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold text-2xl w-12 h-12 rounded-lg transition-colors active:bg-green-700 shadow flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="units" className="block text-sm font-medium mb-1">
                  Units
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => decrement('units')}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold text-2xl w-12 h-12 rounded-lg transition-colors active:bg-red-700 shadow flex items-center justify-center"
                  >
                    −
                  </button>
                  <input
                    id="units"
                    type="number"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="w-16 px-2 py-2 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center h-12"
                    placeholder="0"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => increment('units')}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold text-2xl w-12 h-12 rounded-lg transition-colors active:bg-green-700 shadow flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Total Counter */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Total Count
              </label>
              <div className="bg-gray-100 border-2 border-gray-300 rounded-lg px-3 py-2 text-center">
                <span className="text-2xl font-bold text-gray-800">
                  {(() => {
                    const palletCount = parseInt(pallets) || 0
                    const cartonCount = parseInt(cartons) || 0
                    const unitCount = parseInt(units) || 0
                    // 1 carton = 24 units
                    // 16/10oz pallet = 32 cartons
                    // 26oz pallet = 24 cartons
                    const cartonsPerPallet = size === '26oz' ? 24 : 32
                    const total = (palletCount * cartonsPerPallet * 24) + (cartonCount * 24) + unitCount
                    return total.toLocaleString()
                  })()}
                </span>
                <span className="text-base text-gray-600 ml-2">units</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 text-lg font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Submit Count
            </button>

            {/* Finish Button - Moved up for iPad */}
            <button
              onClick={handleFinish}
              className="w-full bg-red-600 text-white py-3 text-lg font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg mt-3"
            >
              I'M FINISHED COUNTING
            </button>
          </div>
        </form>
      </div>

      {/* All Items Dialog */}
      {showAllItemsDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-4 my-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">All Submitted Items</h2>
              <button
                onClick={() => setShowAllItemsDialog(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto">
              {allSubmittedItems.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No items submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {allSubmittedItems.map((item) => (
                    <ItemEditor
                      key={item.id}
                      item={item}
                      onUpdate={handleUpdateItem}
                      onDelete={handleDeleteItem}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Last Item Dialog */}
      {showLastItemDialog && lastSubmittedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-4">
            <h2 className="text-xl font-bold mb-3">Last Item Submitted</h2>
            
            <div className="space-y-2 mb-4">
              <div>
                <span className="text-sm font-semibold text-gray-700">SKU:</span>
                <span className="text-lg font-bold ml-2">{lastSubmittedItem.sku}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Size:</span>
                <span className="text-lg font-bold ml-2">{lastSubmittedItem.size}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div>
                  <span className="text-sm font-semibold text-gray-700 block mb-1">Pallets:</span>
                  <span className="text-lg font-bold">{lastSubmittedItem.pallets}</span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-700 block mb-1">Cartons:</span>
                  <span className="text-lg font-bold">{lastSubmittedItem.cartons}</span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-700 block mb-1">Units:</span>
                  <span className="text-lg font-bold">{lastSubmittedItem.units}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t-2 border-gray-200">
                <span className="text-sm font-semibold text-gray-700">Total Units:</span>
                <span className="text-xl font-bold ml-2 text-blue-600">
                  {(() => {
                    const cartonsPerPallet = lastSubmittedItem.size === '26oz' ? 24 : 32
                    return ((lastSubmittedItem.pallets * cartonsPerPallet * 24) + (lastSubmittedItem.cartons * 24) + lastSubmittedItem.units).toLocaleString()
                  })()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDeleteLastItem}
                className="flex-1 bg-red-600 text-white py-2 text-base font-semibold rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete This Item
              </button>
              <button
                onClick={handleKeepLastItem}
                className="flex-1 bg-green-600 text-white py-2 text-base font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Keep It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

