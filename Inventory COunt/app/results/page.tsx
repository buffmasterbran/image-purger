'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Count, type CountSession } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

interface EditableCount {
  sku: string
  size: string
  originalSku: string
  originalSize: string
  userA: number // Original count from User A
  userB: number // Original count from User B
  reconciledA: number // User A's reconciled count (editable by User A)
  reconciledB: number // User B's reconciled count (editable by User B)
  finalCount: number | null // Only set when reconciledA === reconciledB
  isEditing: boolean
}

export default function ResultsPage() {
  const router = useRouter()
  const [editableCounts, setEditableCounts] = useState<EditableCount[]>([])
  const [userNames, setUserNames] = useState<{ userA: string; userB: string }>({
    userA: 'User A',
    userB: 'User B',
  })
  const [loading, setLoading] = useState(true)
  const [isCountingAlone, setIsCountingAlone] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<CountSession | null>(null)
  const [currentUserName, setCurrentUserName] = useState('')
  const [hasApproved, setHasApproved] = useState(false)
  const [reconciledCountsFromDB, setReconciledCountsFromDB] = useState<Record<string, Record<string, number>>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null) // Track which SKU_Size is being edited
  const editingKeyRef = useRef<string | null>(null) // Ref to track editing key for real-time updates
  const [hideMatched, setHideMatched] = useState(true) // Default to hiding matched items
  const [lastEditTimestamps, setLastEditTimestamps] = useState<Record<string, { userA?: number, userB?: number }>>({}) // Track when each user last edited each item
  const [isSyncing, setIsSyncing] = useState(false) // Visual indicator for manual sync
  const [confirmedMatchedItems, setConfirmedMatchedItems] = useState<Set<string>>(new Set()) // Track items that were matched at last sync/reload
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<EditableCount | null>(null)
  const [editPallets, setEditPallets] = useState('0')
  const [editCartons, setEditCartons] = useState('0')
  const [editUnits, setEditUnits] = useState('0')
  const editingItemKeyRef = useRef<string | null>(null) // Track which item has edit dialog open

  useEffect(() => {
    const countingAlone = localStorage.getItem('counting_alone') === 'true'
    const userName = localStorage.getItem('counter_name') || ''
    const currentSessionId = localStorage.getItem('current_session_id')
    
    setIsCountingAlone(countingAlone)
    setCurrentUserName(userName)
    setSessionId(currentSessionId)
    
    if (currentSessionId && !countingAlone) {
      // Fetch session status (non-blocking)
      fetchSessionStatus(currentSessionId).catch(err => {
        console.error('Error fetching session status on mount:', err)
      })
    }
    
    // Always fetch results, even if session fetch fails
    fetchResults()
  }, [])

  const fetchSessionStatus = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('count_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle()
      
      if (error) {
        console.error('Error fetching session status:', error)
        // Don't block the page if session fetch fails
        return
      }

      // If no session found, that's okay - might be an old session
      if (!data) {
        console.log('Session not found:', sessionId)
        return
      }
      
      setSessionStatus(data)
      setHasApproved(data.approved_by?.includes(currentUserName) || false)
      
      // Load reconciled counts from database if they exist
      if (data.reconciled_counts && typeof data.reconciled_counts === 'object') {
        setReconciledCountsFromDB(data.reconciled_counts as Record<string, Record<string, number>>)
        // Update editable counts with DB values
        setEditableCounts(prev => {
          const updated = prev.map(count => {
            const key = `${count.originalSku}_${count.originalSize}`
            const reconciled = (data.reconciled_counts as Record<string, Record<string, number>>)?.[key]
            if (reconciled) {
              const reconciledA = reconciled[userNames.userA] ?? count.userA
              const reconciledB = reconciled[userNames.userB] ?? count.userB
              // Don't show final count if edit dialog is open for this item
              const isEditDialogOpen = editingItemKeyRef.current === key
              const finalCount = (!isEditDialogOpen && reconciledA === reconciledB) ? reconciledA : null
              return {
                ...count,
                reconciledA,
                reconciledB,
                finalCount,
              }
            }
            return count
          })
          
          // Update confirmed matched items after loading reconciled counts
          const matched = new Set<string>()
          updated.forEach(count => {
            const key = `${count.originalSku}_${count.originalSize}`
            const difference = count.reconciledA - count.reconciledB
            if (difference === 0 && count.reconciledA === count.reconciledB) {
              matched.add(key)
            }
          })
          setConfirmedMatchedItems(matched)
          
          return updated
        })
      }
    } catch (error) {
      console.error('Error in fetchSessionStatus:', error)
      // Don't block the page if session fetch fails
    }
  }

  const fetchResults = async () => {
    try {
      console.log('fetchResults: Starting...')
      setLoading(true)

      // Get today's date range
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Get current session ID if counting with others
      const currentSessionId = localStorage.getItem('current_session_id')
      const countingAlone = localStorage.getItem('counting_alone') === 'true'

      console.log('fetchResults: sessionId=', currentSessionId, 'countingAlone=', countingAlone)

      // Fetch counts - filter by session_id if counting with others
      let query = supabase
        .from('counts')
        .select('*')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())

      // If counting with others, only get counts from this session
      if (!countingAlone && currentSessionId) {
        query = query.eq('session_id', currentSessionId)
      }

      console.log('fetchResults: Executing query...')
      const { data: countsData, error: countsError } = await query
      console.log('fetchResults: Query result - data length:', countsData?.length, 'error:', countsError)

      if (countsError) {
        console.error('Error fetching counts:', countsError)
        toast.error('Failed to fetch counts')
        setLoading(false)
        return
      }

      // If no counts found, show empty state
      if (!countsData || countsData.length === 0) {
        console.log('No counts found for this session')
        setEditableCounts([])
        setUserNames({
          userA: 'User A',
          userB: 'User B',
        })
        setLoading(false)
        return
      }

      // Get unique counter names
      const uniqueNames = Array.from(
        new Set(countsData?.map((c) => c.counter_name) || [])
      )
      
      if (uniqueNames.length >= 2) {
        setUserNames({
          userA: uniqueNames[0],
          userB: uniqueNames[1],
        })
      } else if (uniqueNames.length === 1) {
        setUserNames({
          userA: uniqueNames[0],
          userB: countingAlone ? '(Solo Count)' : 'User B',
        })
      }

      // Group by SKU and sum by user
      const grouped: Record<string, any> = {}

      countsData?.forEach((count) => {
        const key = `${count.sku}_${count.size}`
        if (!grouped[key]) {
          grouped[key] = {
            sku: count.sku,
            size: count.size,
          }
          uniqueNames.forEach((name) => {
            grouped[key][name] = 0
          })
        }

        // Calculate total units
        const cartonsPerPallet = count.size === '26oz' ? 24 : 32
        const total = (count.pallets * cartonsPerPallet * 24) + (count.cartons * 24) + count.units
        
        if (!grouped[key][count.counter_name]) {
          grouped[key][count.counter_name] = 0
        }
        grouped[key][count.counter_name] += total
      })

      // Convert to editable format
      const editable: EditableCount[] = Object.values(grouped).map((item: any) => {
        const userACount = uniqueNames.length > 0 ? (item[uniqueNames[0]] || 0) : 0
        const userBCount = uniqueNames.length > 1 ? (item[uniqueNames[1]] || 0) : 0
        const key = `${item.sku}_${item.size}`
        
        // Load reconciled counts if they exist
        const reconciled = reconciledCountsFromDB[key]
        const reconciledA = reconciled?.[uniqueNames[0]] ?? userACount
        const reconciledB = uniqueNames.length > 1 ? (reconciled?.[uniqueNames[1]] ?? userBCount) : userBCount
        // Don't show final count if edit dialog is open for this item
        const isEditDialogOpen = editingItemKeyRef.current === key
        const finalCount = (!isEditDialogOpen && reconciledA === reconciledB) ? reconciledA : null
        
        return {
          sku: `${item.sku} (${item.size})`,
          size: item.size,
          originalSku: item.sku,
          originalSize: item.size,
          userA: userACount,
          userB: userBCount,
          reconciledA,
          reconciledB,
          finalCount,
          isEditing: false,
        }
      })

      editable.sort((a, b) => a.sku.localeCompare(b.sku))
      setEditableCounts(editable)
      
      // Update confirmed matched items based on current state (only on initial load/sync)
      const matched = new Set<string>()
      editable.forEach(count => {
        const key = `${count.originalSku}_${count.originalSize}`
        const difference = count.reconciledA - count.reconciledB
        if (difference === 0 && count.reconciledA === count.reconciledB) {
          matched.add(key)
        }
      })
      setConfirmedMatchedItems(matched)
      
      // If we have a session, fetch session status to load reconciled counts
      if (currentSessionId && !countingAlone) {
        fetchSessionStatus(currentSessionId).then(() => {
          // After fetching session status, update editable counts with reconciled values
          if (reconciledCountsFromDB && Object.keys(reconciledCountsFromDB).length > 0) {
            setEditableCounts(prev => {
              const updated = prev.map(count => {
                const key = `${count.originalSku}_${count.originalSize}`
                const reconciled = reconciledCountsFromDB[key]
                if (reconciled) {
                  const reconciledA = reconciled[uniqueNames[0]] ?? count.userA
                  const reconciledB = uniqueNames.length > 1 ? (reconciled[uniqueNames[1]] ?? count.userB) : count.userB
                  // Don't show final count if edit dialog is open for this item
                  const isEditDialogOpen = editingItemKeyRef.current === key
                  const finalCount = (!isEditDialogOpen && reconciledA === reconciledB) ? reconciledA : null
                  return {
                    ...count,
                    reconciledA,
                    reconciledB,
                    finalCount,
                  }
                }
                return count
              })
              
              // Update confirmed matched items after loading reconciled counts
              const matchedAfterReconcile = new Set<string>()
              updated.forEach(count => {
                const key = `${count.originalSku}_${count.originalSize}`
                const difference = count.reconciledA - count.reconciledB
                if (difference === 0 && count.reconciledA === count.reconciledB) {
                  matchedAfterReconcile.add(key)
                }
              })
              setConfirmedMatchedItems(matchedAfterReconcile)
              
              return updated
            })
          }
        }).catch(err => {
          console.error('Error fetching session status:', err)
          // Don't block the page
        })
      }
    } catch (error) {
      console.error('Error in fetchResults:', error)
      toast.error('Failed to fetch results')
    } finally {
      setLoading(false)
    }
  }

  const updateUserCount = async (key: string, value: number) => {
    // Set editing flag to prevent real-time subscription from overwriting
    setEditingKey(key)
    editingKeyRef.current = key
    
    // Track edit timestamp and update counts
    const isUserA = currentUserName === userNames.userA
    const now = Date.now()
    
    // Update timestamps and counts together
    setLastEditTimestamps(currentTimestamps => {
      // Update timestamp first
      const updatedTimestamps = {
        ...currentTimestamps,
        [key]: {
          ...currentTimestamps[key],
          [isUserA ? 'userA' : 'userB']: now,
        }
      }
      
      // Check if either user edited recently (within 3 seconds)
      const timestamps = updatedTimestamps[key] || {}
      const userAEditedRecently = timestamps.userA && (now - timestamps.userA < 3000)
      const userBEditedRecently = timestamps.userB && (now - timestamps.userB < 3000)
      
      // Check if edit dialog is open for this item (prevents matched status while actively editing)
      const isEditDialogOpen = editingItemKeyRef.current === key
      
      // Update editable counts with the timestamp check
      setEditableCounts(prev => prev.map(count => {
        const countKey = `${count.originalSku}_${count.originalSize}`
        if (countKey === key) {
          const newReconciledA = isUserA ? value : count.reconciledA
          const newReconciledB = !isUserA ? value : count.reconciledB
          // Don't show final count if either user edited recently OR edit dialog is open
          const finalCount = (!userAEditedRecently && !userBEditedRecently && !isEditDialogOpen && newReconciledA === newReconciledB) ? newReconciledA : null
          return {
            ...count,
            reconciledA: newReconciledA,
            reconciledB: newReconciledB,
            finalCount,
          }
        }
        return count
      }))
      
      return updatedTimestamps
    })
    
    // Save to database in real-time
    if (sessionId && !isCountingAlone) {
      try {
        const newReconciledCounts = { ...reconciledCountsFromDB }
        if (!newReconciledCounts[key]) {
          newReconciledCounts[key] = {}
        }
        newReconciledCounts[key][currentUserName] = value
        
        // Calculate final count if both users have matching values
        const userAValue = newReconciledCounts[key][userNames.userA] ?? 0
        const userBValue = newReconciledCounts[key][userNames.userB] ?? 0
        
        console.log('Updating reconciled count:', { sessionId, key, currentUserName, value, newReconciledCounts })
        
        const { data, error } = await supabase
          .from('count_sessions')
          .update({ reconciled_counts: newReconciledCounts })
          .eq('session_id', sessionId)
          .select()
        
        if (error) {
          console.error('Error updating reconciled count:', error)
          toast.error(`Failed to update count: ${error.message || 'Unknown error'}`)
          // Revert the change on error
          fetchResults()
          setEditingKey(null)
          editingKeyRef.current = null
          return
        }
        
        console.log('Successfully updated reconciled count:', data)
        setReconciledCountsFromDB(newReconciledCounts)
        // Clear editing flag after successful save
        setTimeout(() => {
          setEditingKey(null)
          editingKeyRef.current = null
        }, 300)
      } catch (error: any) {
        console.error('Error in updateUserCount:', error)
        toast.error(`Failed to update count: ${error?.message || 'Unknown error'}`)
        // Revert the change on error
        fetchResults()
        setEditingKey(null)
        editingKeyRef.current = null
      }
    } else {
      setEditingKey(null)
      editingKeyRef.current = null
    }
  }

  const handleApprove = async () => {
    if (!sessionId || !currentUserName) {
      toast.error('Session information missing')
      return
    }

    // Check if all items have matching reconciled counts (finalCount is set)
    const unmatchedItems = editableCounts.filter(count => count.finalCount === null)
    if (unmatchedItems.length > 0) {
      toast.error(`Please reconcile all differences. ${unmatchedItems.length} item(s) still have mismatched counts.`)
      return
    }

    if (!confirm('Are you sure you want to approve this count? Once both parties approve, the count will be finalized.')) {
      return
    }

    try {
      // Get current session
      const { data: session } = await supabase
        .from('count_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      if (!session) {
        toast.error('Session not found')
        return
      }

      // Save final counts to database (for backward compatibility and history)
      const finalCountsToSave: Record<string, number> = {}
      editableCounts.forEach(count => {
        const key = `${count.originalSku}_${count.originalSize}`
        if (count.finalCount !== null) {
          finalCountsToSave[key] = count.finalCount
        }
      })

      const approvedBy = [...(session.approved_by || []), currentUserName]
      const uniqueApproved = Array.from(new Set(approvedBy))

      const updateData: any = {
        approved_by: uniqueApproved,
        final_counts: finalCountsToSave, // Save final counts for backward compatibility
        reconciled_counts: reconciledCountsFromDB, // Save reconciled counts
      }

      // If all participants have approved, finalize
      if (uniqueApproved.length >= session.participants.length) {
        updateData.status = 'finalized'
        updateData.finalized_at = new Date().toISOString()
      } else {
        updateData.status = 'approved'
      }

      const { error } = await supabase
        .from('count_sessions')
        .update(updateData)
        .eq('session_id', sessionId)

      if (error) {
        console.error('Error approving count:', error)
        toast.error('Failed to approve count')
        return
      }

      setHasApproved(true)
      setSessionStatus({ ...session, ...updateData })

      if (uniqueApproved.length >= session.participants.length) {
        toast.success('Count finalized! All participants have approved.')
      } else {
        toast.success('Count approved! Waiting for other participant(s) to approve.')
      }

      // Subscribe to changes
      const channel = supabase
        .channel('session_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'count_sessions',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const updated = payload.new as CountSession
            setSessionStatus(updated)
            if (updated.status === 'finalized') {
              toast.success('Count has been finalized by all participants!')
            }
          }
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    } catch (error) {
      console.error('Error in handleApprove:', error)
      toast.error('Failed to approve count')
    }
  }

  const handleStartOver = () => {
    // Clear session data so user can choose solo or multi-person for next count
    localStorage.removeItem('current_session_id')
    localStorage.removeItem('counting_alone')
    // Keep counter_name so they don't have to re-enter it
    // Use window.location.href to force a full page reload and reset component state
    window.location.href = '/'
  }

  // Convert total units back to pallets/cartons/units
  const unitsToBreakdown = (totalUnits: number, size: string) => {
    const cartonsPerPallet = size === '26oz' ? 24 : 32
    const unitsPerCarton = 24
    const unitsPerPallet = cartonsPerPallet * unitsPerCarton
    
    const pallets = Math.floor(totalUnits / unitsPerPallet)
    const remainingAfterPallets = totalUnits % unitsPerPallet
    const cartons = Math.floor(remainingAfterPallets / unitsPerCarton)
    const units = remainingAfterPallets % unitsPerCarton
    
    return { pallets, cartons, units }
  }

  const openEditDialog = (count: EditableCount) => {
    const isCurrentUserA = currentUserName === userNames.userA
    const currentCount = isCurrentUserA ? count.reconciledA : count.reconciledB
    const breakdown = unitsToBreakdown(currentCount, count.originalSize)
    
    const key = `${count.originalSku}_${count.originalSize}`
    editingItemKeyRef.current = key // Track that edit dialog is open for this item
    
    setEditingItem(count)
    setEditPallets(breakdown.pallets.toString())
    setEditCartons(breakdown.cartons.toString())
    setEditUnits(breakdown.units.toString())
    setEditDialogOpen(true)
    
    // Clear any final count while editing (prevent matched status)
    setEditableCounts(prev => prev.map(c => {
      const countKey = `${c.originalSku}_${c.originalSize}`
      if (countKey === key) {
        return { ...c, finalCount: null }
      }
      return c
    }))
  }

  const closeEditDialog = () => {
    editingItemKeyRef.current = null // Clear edit dialog tracking
    setEditDialogOpen(false)
    setEditingItem(null)
    setEditPallets('0')
    setEditCartons('0')
    setEditUnits('0')
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return

    const pallets = parseInt(editPallets) || 0
    const cartons = parseInt(editCartons) || 0
    const units = parseInt(editUnits) || 0
    
    const cartonsPerPallet = editingItem.originalSize === '26oz' ? 24 : 32
    const totalUnits = (pallets * cartonsPerPallet * 24) + (cartons * 24) + units
    
    const key = `${editingItem.originalSku}_${editingItem.originalSize}`
    await updateUserCount(key, totalUnits)
    closeEditDialog()
    toast.success('Count updated!')
  }

  const increment = (field: 'pallets' | 'cartons' | 'units') => {
    if (field === 'pallets') {
      setEditPallets((prev) => (parseInt(prev) + 1).toString())
    } else if (field === 'cartons') {
      setEditCartons((prev) => (parseInt(prev) + 1).toString())
    } else {
      setEditUnits((prev) => (parseInt(prev) + 1).toString())
    }
  }

  const decrement = (field: 'pallets' | 'cartons' | 'units') => {
    if (field === 'pallets') {
      const current = parseInt(editPallets) || 0
      setEditPallets(Math.max(0, current - 1).toString())
    } else if (field === 'cartons') {
      const current = parseInt(editCartons) || 0
      const cartonsPerPallet = editingItem?.originalSize === '26oz' ? 24 : 32
      if (current === 0) {
        setEditCartons((cartonsPerPallet - 1).toString())
      } else {
        setEditCartons((current - 1).toString())
      }
    } else {
      const current = parseInt(editUnits) || 0
      if (current === 0) {
        setEditUnits('23')
      } else {
        setEditUnits((current - 1).toString())
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-2xl">Loading results...</div>
      </div>
    )
  }

  const isFinalized = sessionStatus?.status === 'finalized'
  const allApproved = (sessionStatus?.approved_by?.length || 0) >= (sessionStatus?.participants?.length || 0)

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Toaster />
      <div className="container mx-auto max-w-7xl px-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Comparison Report</h1>
        
        {isCountingAlone && (
          <div className="bg-blue-500 border-l-4 border-blue-600 text-white p-4 mb-6 rounded">
            <p className="font-semibold">Solo Count Mode</p>
            <p>You are viewing your counts only. No comparison available.</p>
          </div>
        )}

        {!isCountingAlone && sessionStatus && (
          <div className={`border-l-4 p-4 mb-6 rounded ${
            isFinalized 
              ? 'bg-green-500 border-green-600 text-white'
              : allApproved
              ? 'bg-yellow-500 border-yellow-600 text-white'
              : 'bg-blue-500 border-blue-600 text-white'
          }`}>
            <p className="font-semibold text-xl">
              {isFinalized 
                ? '✓ Count Finalized'
                : allApproved
                ? '⏳ Waiting for Finalization'
                : 'Review and Approve Count'}
            </p>
            <p className="mt-1">
              Participants: {sessionStatus.participants?.join(', ')}
            </p>
            <p className="mt-1">
              Approved by: {sessionStatus.approved_by?.length > 0 ? sessionStatus.approved_by.join(', ') : 'None yet'}
            </p>
            {!isFinalized && (
              <p className="mt-2 font-semibold text-red-200">
                ⚠️ IMPORTANT: The numbers must match before approval! Both parties must agree on the same final counts.
              </p>
            )}
          </div>
        )}

        {editableCounts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-xl text-gray-600">No counts found for today.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="px-8 py-4 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideMatched}
                    onChange={(e) => setHideMatched(e.target.checked)}
                    className="w-6 h-6 cursor-pointer"
                  />
                  <span className="text-lg font-semibold text-gray-700">
                    Hide Matched Items (Show Only Errors)
                  </span>
                </label>
              </div>
              {!isCountingAlone && sessionId && (
                <button
                  onClick={async () => {
                    setIsSyncing(true)
                    try {
                      await Promise.all([
                        fetchResults(),
                        fetchSessionStatus(sessionId)
                      ])
                      // Update confirmed matched items after sync
                      setEditableCounts(prev => {
                        const matched = new Set<string>()
                        prev.forEach(count => {
                          const key = `${count.originalSku}_${count.originalSize}`
                          const difference = count.reconciledA - count.reconciledB
                          if (difference === 0 && count.reconciledA === count.reconciledB) {
                            matched.add(key)
                          }
                        })
                        setConfirmedMatchedItems(matched)
                        return prev
                      })
                    } finally {
                      setIsSyncing(false)
                    }
                  }}
                  disabled={isSyncing}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-lg font-semibold"
                  title="Sync to get the latest counts from other users"
                >
                  {isSyncing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Sync</span>
                    </>
                  )}
                </button>
              )}
              <div className="text-lg text-gray-600">
                {(() => {
                  const filtered = editableCounts.filter((count) => {
                    const key = `${count.originalSku}_${count.originalSize}`
                    const isCurrentlyEditing = editingKeyRef.current === key
                    const isEditDialogOpen = editingItemKeyRef.current === key
                    const isConfirmedMatched = confirmedMatchedItems.has(key)
                    
                    if (!hideMatched) return true
                    if (isCurrentlyEditing || isEditDialogOpen) return true
                    return !isConfirmedMatched
                  })
                  const matchedCount = confirmedMatchedItems.size
                  return (
                    <>
                      Showing {filtered.length} of {editableCounts.length} items
                      {hideMatched && matchedCount > 0 && (
                        <span className="text-green-600 ml-2">
                          ({matchedCount} matched hidden)
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-8 py-5 text-left text-xl font-semibold">SKU</th>
                    <th className="px-8 py-5 text-center text-xl font-semibold">
                      {userNames.userA} Count {currentUserName === userNames.userA && '(Editable)'}
                    </th>
                    <th className="px-8 py-5 text-center text-xl font-semibold">
                      {userNames.userB} Count {currentUserName === userNames.userB && '(Editable)'}
                    </th>
                    <th className="px-8 py-5 text-center text-xl font-semibold">
                      Difference
                    </th>
                    {!isCountingAlone && (
                      <th className="px-8 py-5 text-center text-xl font-semibold">
                        Final Count
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {editableCounts
                    .filter((count) => {
                      const key = `${count.originalSku}_${count.originalSize}`
                      // Don't hide if:
                      // 1. hideMatched is false, OR
                      // 2. Item is not in confirmedMatchedItems (wasn't matched at last sync), OR
                      // 3. Item is currently being edited, OR
                      // 4. Edit dialog is open for this item
                      const isCurrentlyEditing = editingKeyRef.current === key
                      const isEditDialogOpen = editingItemKeyRef.current === key
                      const isConfirmedMatched = confirmedMatchedItems.has(key)
                      
                      if (!hideMatched) return true
                      if (isCurrentlyEditing || isEditDialogOpen) return true
                      return !isConfirmedMatched
                    })
                    .map((count) => {
                    const key = `${count.originalSku}_${count.originalSize}`
                    const difference = count.reconciledA - count.reconciledB
                    const isMatched = difference === 0 && count.reconciledA === count.reconciledB
                    const isCurrentUserA = currentUserName === userNames.userA
                    const isCurrentUserB = currentUserName === userNames.userB
                    const isEditing = editingKey === key
                    
                    return (
                      <tr
                        key={key}
                        className={`${
                          isMatched
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-red-500 hover:bg-red-600 text-white'
                        } transition-colors`}
                      >
                        <td className="px-8 py-5 text-xl font-medium">{count.sku}</td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isCountingAlone || !isCurrentUserA ? (
                              <span className="text-xl">{count.reconciledA.toLocaleString()}</span>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  value={count.reconciledA || 0}
                                  onChange={(e) => {
                                    const newValue = parseInt(e.target.value) || 0
                                    updateUserCount(key, newValue)
                                  }}
                                  onBlur={(e) => {
                                    const newValue = parseInt(e.target.value) || 0
                                    if (newValue !== count.reconciledA) {
                                      updateUserCount(key, newValue)
                                    }
                                    setEditingKey(null)
                                    editingKeyRef.current = null
                                  }}
                                  disabled={isFinalized}
                                  className="w-32 px-4 py-2 text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center bg-white text-gray-900 font-semibold"
                                />
                                <button
                                  onClick={() => openEditDialog(count)}
                                  disabled={isFinalized}
                                  className="text-white hover:text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                  title="Edit count details"
                                >
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isCountingAlone || !isCurrentUserB ? (
                              <span className="text-xl">{count.reconciledB.toLocaleString()}</span>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  value={count.reconciledB || 0}
                                  onChange={(e) => {
                                    const newValue = parseInt(e.target.value) || 0
                                    updateUserCount(key, newValue)
                                  }}
                                  onBlur={(e) => {
                                    const newValue = parseInt(e.target.value) || 0
                                    if (newValue !== count.reconciledB) {
                                      updateUserCount(key, newValue)
                                    }
                                    setEditingKey(null)
                                    editingKeyRef.current = null
                                  }}
                                  disabled={isFinalized}
                                  className="w-32 px-4 py-2 text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center bg-white text-gray-900 font-semibold"
                                />
                                <button
                                  onClick={() => openEditDialog(count)}
                                  disabled={isFinalized}
                                  className="text-white hover:text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                  title="Edit count details"
                                >
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center text-xl font-semibold">
                          {isMatched ? (
                            <span className="text-white">✓ Match</span>
                          ) : (
                            <span className="text-white">
                              {difference > 0 ? '+' : ''}
                              {difference.toLocaleString()}
                            </span>
                          )}
                        </td>
                        {!isCountingAlone && (
                          <td className="px-8 py-5 text-center">
                            {count.finalCount !== null ? (
                              <span className="text-xl font-bold text-white">
                                {count.finalCount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-lg text-white opacity-75">Pending match</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center space-y-4">
          {!isCountingAlone && sessionStatus && !isFinalized && (
            <button
              onClick={handleApprove}
              disabled={hasApproved}
              className={`px-12 py-6 text-2xl font-semibold rounded-lg transition-colors shadow-lg ${
                hasApproved
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {hasApproved ? '✓ You Have Approved' : 'Approve Count'}
            </button>
          )}
          
          <div>
            <button
              onClick={handleStartOver}
              className="bg-blue-600 text-white px-12 py-6 text-2xl font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              Start Over / New Count
            </button>
          </div>
        </div>

        {/* Edit Dialog */}
        {editDialogOpen && editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-10 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Edit Count</h2>
                <button
                  onClick={closeEditDialog}
                  className="text-3xl text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <p className="text-xl font-semibold mb-2">SKU: {editingItem.originalSku}</p>
                  <p className="text-lg text-gray-600">Size: {editingItem.originalSize}</p>
                </div>

                <div>
                  <label className="block text-lg font-medium mb-3">Size</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      disabled
                      className={`flex-1 py-3 text-lg font-semibold rounded-lg border-2 ${
                        editingItem.originalSize === '16/10oz'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-200 text-gray-500 border-gray-300'
                      }`}
                    >
                      16/10oz
                    </button>
                    <button
                      type="button"
                      disabled
                      className={`flex-1 py-3 text-lg font-semibold rounded-lg border-2 ${
                        editingItem.originalSize === '26oz'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-200 text-gray-500 border-gray-300'
                      }`}
                    >
                      26oz
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-lg font-medium mb-3">Pallets</label>
                    <div className="flex items-center gap-5">
                      <button
                        type="button"
                        onClick={() => decrement('pallets')}
                        className="w-20 h-20 text-4xl font-bold bg-gray-200 hover:bg-gray-300 rounded-lg active:bg-gray-400 transition-colors flex-shrink-0"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={editPallets}
                        onChange={(e) => setEditPallets(e.target.value)}
                        className="flex-1 px-6 py-5 text-3xl border-2 border-gray-300 rounded-lg text-center font-semibold"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => increment('pallets')}
                        className="w-20 h-20 text-4xl font-bold bg-gray-200 hover:bg-gray-300 rounded-lg active:bg-gray-400 transition-colors flex-shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-lg font-medium mb-3">Cartons</label>
                    <div className="flex items-center gap-5">
                      <button
                        type="button"
                        onClick={() => decrement('cartons')}
                        className="w-20 h-20 text-4xl font-bold bg-gray-200 hover:bg-gray-300 rounded-lg active:bg-gray-400 transition-colors flex-shrink-0"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={editCartons}
                        onChange={(e) => setEditCartons(e.target.value)}
                        className="flex-1 px-6 py-5 text-3xl border-2 border-gray-300 rounded-lg text-center font-semibold"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => increment('cartons')}
                        className="w-20 h-20 text-4xl font-bold bg-gray-200 hover:bg-gray-300 rounded-lg active:bg-gray-400 transition-colors flex-shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-lg font-medium mb-3">Units</label>
                    <div className="flex items-center gap-5">
                      <button
                        type="button"
                        onClick={() => decrement('units')}
                        className="w-20 h-20 text-4xl font-bold bg-gray-200 hover:bg-gray-300 rounded-lg active:bg-gray-400 transition-colors flex-shrink-0"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={editUnits}
                        onChange={(e) => setEditUnits(e.target.value)}
                        className="flex-1 px-6 py-5 text-3xl border-2 border-gray-300 rounded-lg text-center font-semibold"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => increment('units')}
                        className="w-20 h-20 text-4xl font-bold bg-gray-200 hover:bg-gray-300 rounded-lg active:bg-gray-400 transition-colors flex-shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-lg font-semibold">
                    Total: {(() => {
                      const cartonsPerPallet = editingItem.originalSize === '26oz' ? 24 : 32
                      const total = (parseInt(editPallets) * cartonsPerPallet * 24) + (parseInt(editCartons) * 24) + parseInt(editUnits)
                      return total.toLocaleString()
                    })()} units
                  </p>
                </div>

                <div className="flex gap-6">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-green-600 text-white px-8 py-5 text-xl font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={closeEditDialog}
                    className="flex-1 bg-gray-600 text-white px-8 py-5 text-xl font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
