// supabase.js
(() => {
  // TODO: Rellena con tus valores reales
  const SUPABASE_URL = 'https://pvpklqdzvmvhaspsnirm.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cGtscWR6dm12aGFzcHNuaXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MDAxMTQsImV4cCI6MjA3MTE3NjExNH0.FPlgajGCF5Y7akqaAuRoVsR67iidFOf2luUhDiYtTQ8';

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.sb = sb; // expón para que el resto pueda usarlo

  // === Helpers Auth ===
async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    console.error('SIGNUP error:', error); // 👈 aquí verás más info en la consola del navegador
    throw error;
  }
  console.log('SIGNUP ok:', data);
  return data;
}

async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('SIGNIN error:', error); // 👈 lo mismo para login
    throw error;
  }
  console.log('SIGNIN ok:', data);
  return data;
}

  async function signOut() {
    await sb.auth.signOut();
  }
async function getUser() {
  // 1) mira la sesión guardada (no llama a red si no hay)
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  // 2) valida/refresca el usuario (aquí sí puede ir a red)
  const { data, error } = await sb.auth.getUser();
  if (error) return null;
  return data.user || null;
}

  // === Helpers Storage: subir imagen de fondo ===
  // Guarda en: images/backgrounds/<userId>/<uuid>.png
  async function uploadBg(file) {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');
    const name = crypto.randomUUID() + '.' + (file.name.split('.').pop() || 'png');
    const path = `backgrounds/${user.id}/${name}`;
    const { error } = await sb.storage.from('images').upload(path, file, {
      upsert: false,
      cacheControl: '31536000',
      contentType: file.type || 'image/png'
    });
    if (error) throw error;
    const { data: pub } = sb.storage.from('images').getPublicUrl(path);
    return pub.publicUrl;
  }

  // === Helpers DB: poke_boxes ===
  // Si quieres una sola caja por usuario, actualizamos por UPSERT usando user_id único
  async function saveBox(payload, name = 'Mi caja') {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');
    const rowData = {
      data: payload,
      name,
      user_email: user.email,
      updated_at: new Date().toISOString()
    };

    // si quieres “una por usuario”, puedes upsert por user_id:
    const { data: existing } = await sb
      .from('poke_boxes')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data, error } = await sb
        .from('poke_boxes')
        .update(rowData)
        .eq('id', existing.id)
        .select('id, name, data, updated_at')
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await sb
        .from('poke_boxes')
        .insert({ user_id: user.id, ...rowData })
        .select('id, name, data, updated_at')
        .single();
      if (error) throw error;
      return data;
    }
  }

  async function loadBox() {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');
    const { data, error } = await sb
      .from('poke_boxes')
      .select('id, name, data, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data; // puede ser null si aún no hay caja
  }

  async function createBoxBackup(payload, reason = 'manual') {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    const { data, error } = await sb
      .from('poke_box_backups')
      .insert({
        user_id: user.id,
        user_email: user.email,
        name: `Backup ${new Date().toLocaleString('es-ES')}`,
        reason,
        data: payload,
        device_id: payload?.deviceId || null
      })
      .select('id, created_at')
      .single();
    if (error) throw error;
    return data;
  }

  async function listBoxBackups(limit = 20) {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    const { data, error } = await sb
      .from('poke_box_backups')
      .select('id, name, reason, created_at, data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  // === Helpers DB: usuarios (para búsqueda de compañeros) ===
  async function listUsers() {
    const currentUser = await getUser();
    if (!currentUser) throw new Error('Debes iniciar sesión');
    
    // Obtener todos los usuarios excepto el actual
    const { data, error } = await sb
      .from('auth.users')
      .select('id, email')
      .neq('id', currentUser.id);
    
    // Si hay error al acceder a auth.users, usar tabla alternativa
    if (error) {
      // Fallback: listar usuarios con cajas
      const { data: boxes, error: boxError } = await sb
        .from('poke_boxes')
        .select('user_id, user_email')
        .neq('user_id', currentUser.id)
        .limit(100);
      
      if (boxError) throw boxError;
      return (boxes || []).map(b => ({ id: b.user_id, email: b.user_email }));
    }
    
    return data || [];
  }

  // === Helpers DB: trades (intercambios) ===
  async function createTrade(tradeData) {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    // permitimos guardar también los datos completos de los Pokémon
    const { data, error } = await sb
      .from('trades')
      .insert({
        initiator_id: user.id,
        initiator_email: user.email,
        target_user_id: tradeData.targetUserId,
        initiator_pokemon_id: tradeData.initiatorPokemonId,
        target_pokemon_id: tradeData.targetPokemonId,
        initiator_pokemon_data: tradeData.initiator_pokemon_data || null,
        target_pokemon_data: tradeData.target_pokemon_data || null,
        status: 'pending', // global status (kept for backward compat)
        receiver_status: 'pending',
        initiator_status: 'pending',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async function getPendingTrades() {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    // Devuelve solicitudes relevantes para el usuario: como receptor (receiver_status pending)
    // o como iniciador (initiator_status pending). Excluimos completadas.
    const { data, error } = await sb
      .from('trades')
      .select('*')
      .or(
        `and(target_user_id.eq.${user.id},receiver_status.eq.pending),and(initiator_id.eq.${user.id},initiator_status.eq.pending)`
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function getUserTrades({ includeClosed = false, limit = 50 } = {}) {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    let q = sb
      .from('trades')
      .select('*')
      .or(`target_user_id.eq.${user.id},initiator_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!includeClosed) q = q.eq('status', 'pending');

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  // role: 'receiver' | 'initiator'
  async function acceptTrade(tradeId, role = 'receiver') {
    if (role === 'receiver') {
      const { data, error } = await sb.rpc('accept_and_complete_trade', { p_trade_id: tradeId });
      if (error) throw error;
      return data;
    }

    const field = role === 'initiator' ? 'initiator_status' : 'receiver_status';
    const updates = {};
    updates[field] = 'accepted';
    updates.updated_at = new Date().toISOString();

    const { data, error } = await sb
      .from('trades')
      .update(updates)
      .eq('id', tradeId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async function rejectTrade(tradeId) {
    const { data, error } = await sb
      .from('trades')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', tradeId);

    if (error) throw error;
    return data;
  }

  async function completeTrade(tradeId) {
    const { data, error } = await sb.rpc('complete_trade_swap', { p_trade_id: tradeId });

    if (error) throw error;
    return data;
  }

  async function getTradeById(tradeId) {
    const { data, error } = await sb
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (error) throw error;
    return data;
  }

  // Upsert caja para un usuario dado (usa upsert por user_id)
  async function updateBoxForUser(userId, boxData, name = 'Mi caja') {
    const { data, error } = await sb
      .from('poke_boxes')
      .upsert({ user_id: userId, user_email: null, data: boxData, name }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (error) throw error;
    return data;
  }

  // Suscripción en tiempo real a cambios en la tabla trades
  async function subscribeTrades(onEvent) {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    const channel = sb
      .channel(`public:trades:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, (payload) => {
        try {
          const row = payload.new || payload.old || {};
          if (row.initiator_id === user.id || row.target_user_id === user.id) {
            onEvent(payload);
          }
        } catch (e) { console.error('subscribeTrades handler error', e); }
      })
      .subscribe();

    return {
      channel,
      unsubscribe: async () => {
        try { await sb.removeChannel(channel); } catch (e) { console.warn('removeChannel failed', e); }
      }
    };
  }

  async function subscribeBoxChanges(onEvent) {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    const channel = sb
      .channel(`public:poke_boxes:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poke_boxes',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          try {
            onEvent(payload);
          } catch (e) {
            console.error('subscribeBoxChanges handler error', e);
          }
        }
      )
      .subscribe();

    return {
      channel,
      unsubscribe: async () => {
        try { await sb.removeChannel(channel); } catch (e) { console.warn('removeChannel failed', e); }
      }
    };
  }

  // expone helpers
  window.Supa = { 
    signUp, signIn, signOut, getUser, uploadBg, saveBox, loadBox,
    createBoxBackup, listBoxBackups, subscribeBoxChanges,
    listUsers, createTrade, getPendingTrades, getUserTrades, acceptTrade, rejectTrade, 
    completeTrade, getTradeById, updateBoxForUser, subscribeTrades
  };
})();
