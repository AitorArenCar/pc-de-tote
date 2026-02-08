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

    // si quieres “una por usuario”, puedes upsert por user_id:
    const { data: existing } = await sb
      .from('poke_boxes')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await sb
        .from('poke_boxes')
        .update({ data: payload, name, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
      return existing.id;
    } else {
      const { data, error } = await sb
        .from('poke_boxes')
        .insert({ user_id: user.id, data: payload, name })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
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
        .select('user_id')
        .neq('user_id', currentUser.id)
        .limit(100);
      
      if (boxError) throw boxError;
      return (boxes || []).map(b => ({ id: b.user_id }));
    }
    
    return data || [];
  }

  // === Helpers DB: trades (intercambios) ===
  async function createTrade(tradeData) {
    const user = await getUser();
    if (!user) throw new Error('Debes iniciar sesión');

    const { data, error } = await sb
      .from('trades')
      .insert({
        initiator_id: user.id,
        initiator_email: user.email,
        target_user_id: tradeData.targetUserId,
        initiator_pokemon_id: tradeData.initiatorPokemonId,
        target_pokemon_id: tradeData.targetPokemonId,
        status: 'pending', // pending, accepted, rejected, completed
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

    const { data, error } = await sb
      .from('trades')
      .select('*')
      .eq('target_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function acceptTrade(tradeId) {
    const { data, error } = await sb
      .from('trades')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
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
    const { data, error } = await sb
      .from('trades')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', tradeId)
      .select('*')
      .single();

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

  // expone helpers
  window.Supa = { 
    signUp, signIn, signOut, getUser, uploadBg, saveBox, loadBox,
    listUsers, createTrade, getPendingTrades, acceptTrade, rejectTrade, 
    completeTrade, getTradeById 
  };
})();
