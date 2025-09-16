import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar, Search, UtensilsCrossed, ShoppingBag, Palette, CheckSquare, Share2, Archive, LogIn, UserCircle } from 'lucide-react';
import { supabase } from './supabase';
import './App.css';

// TypeScriptの型定義
interface TaskinoItem {
  id: string;
  title: string;
  description?: string;
  category: 'go' | 'eat' | 'buy' | 'do' | 'other';
  location?: { name: string; address: string; };
  completed: boolean;
  start_at?: string;
  end_at?: string;
  created_by: string;
  created_at: string;
  image_url?: string;
  user_id?: string;
}
interface Room {
  id: string;
  name: string;
  share_code: string;
  created_at: string;
}
interface Like {
  id: string;
  item_id: string;
  user_id: string;
}

// カテゴリーの定義
const categories = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'go', label: 'To Go', icon: MapPin },
  { id: 'eat', label: 'To Eat', icon: UtensilsCrossed },
  { id: 'buy', label: 'To Buy', icon: ShoppingBag },
  { id: 'do', label: 'To Do', icon: CheckSquare },
  { id: 'other', label: 'Other', icon: Palette },
];

// メインのアプリケーションコンポーネント
function TaskinoApp() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<TaskinoItem[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TaskinoItem | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [newItem, setNewItem] = useState({
    title: '', description: '', category: 'go' as 'go' | 'eat' | 'buy' | 'do' | 'other',
    location: { name: '', address: '' }, start_at: '', end_at: '', createdBy: ''
  });
  const [showArchived, setShowArchived] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isImageMarkedForDeletion, setIsImageMarkedForDeletion] = useState(false);
  const [session, setSession] = useState<any | null>(null);
  const [showTimeInputs, setShowTimeInputs] = useState(false);
  const [isRange, setIsRange] = useState(false);
  const [likes, setLikes] = useState<Record<string, Like[]>>({});
  
  const currentRoomRef = useRef(currentRoom);
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  const fetchLikesForItems = useCallback(async (itemIds: string[]) => {
    if (itemIds.length === 0) return;
    try {
      const { data, error: fetchError } = await supabase.from('likes').select('id, item_id, user_id').in('item_id', itemIds);
      if (fetchError) throw fetchError;

      const likesByItem: Record<string, Like[]> = {};
      itemIds.forEach(id => { likesByItem[id] = []; });
      data.forEach(like => {
        if (likesByItem[like.item_id]) {
          likesByItem[like.item_id].push(like);
        }
      });
      setLikes(prevLikes => ({ ...prevLikes, ...likesByItem }));
    } catch (err) {
      console.error('Error fetching likes:', err);
    }
  }, []);

  const fetchItems = useCallback(async (archived = false) => {
    if (!currentRoomRef.current) return;
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('taskino_items').select('*').eq('room_id', currentRoomRef.current.id)
        .eq('archived', archived).order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      const fetchedItems = data || [];
      setItems(fetchedItems);
      if (fetchedItems.length > 0) {
        const itemIds = fetchedItems.map(item => item.id);
        await fetchLikesForItems(itemIds);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchLikesForItems]);

  const showArchivedRef = useRef(showArchived);
  useEffect(() => {
    showArchivedRef.current = showArchived;
  }, [showArchived]);

  const fetchRoom = useCallback(async () => {
    if (!shareCode) return;
    try {
      const { data, error: fetchError } = await supabase.from('rooms').select('*').eq('share_code', shareCode).single();
      if (fetchError) throw fetchError;
      setCurrentRoom(data);
    } catch (err) {
      setError('Room not found');
    }
  }, [shareCode]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);
  
  useEffect(() => {
    if (currentRoom) fetchItems(showArchived);
  }, [currentRoom, showArchived, fetchItems]);

  useEffect(() => {
    if (currentRoom) {
      document.title = `${currentRoom.name} - taskino`;
      const savedName = localStorage.getItem(`taskino_username_${currentRoom.id}`);
      if (savedName) {
        setCurrentUserName(savedName);
      } else if (!session) {
        setShowNamePrompt(true);
      }
    } else {
      document.title = 'taskino';
    }
  }, [currentRoom, session]);

  useEffect(() => {
    if (!currentRoom) return;
    const channel = supabase
      .channel(`room_${currentRoom.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taskino_items' },
        () => fetchItems(showArchivedRef.current)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom, fetchItems]);
  
  useEffect(() => {
    const cleanupUrl = () => {
      if (window.location.hash.includes('access_token') || window.location.search.includes('code=')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      cleanupUrl();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN') {
        cleanupUrl();
        
        const checkAndClaimPosts = () => {
          const currentRoomValue = currentRoomRef.current;
          if (currentRoomValue) {
            const guestName = localStorage.getItem(`taskino_username_${currentRoomValue.id}`);
            if (guestName) {
              setTimeout(() => {
                if (window.confirm(`You were previously posting as "${guestName}" in this room. Link these posts to your new account?`)) {
                  supabase.functions.invoke('claim-guest-posts', {
                    body: { guestName, roomId: currentRoomValue.id },
                  }).then(({ error: funcError }) => {
                    if (funcError) {
                      alert(`Error: ${funcError.message}`);
                    } else {
                      alert('Posts have been linked to your account!');
                      setCurrentUserName(guestName);
                      localStorage.removeItem(`taskino_username_${currentRoomValue.id}`);
                      fetchItems(showArchivedRef.current);
                    }
                  });
                } else { // このelseの位置が重要
                  // 「いいえ」を選んだ場合、ゲスト名を削除し、新しい名前の入力を促す
                  localStorage.removeItem(`taskino_username_${currentRoomValue.id}`);
                  setCurrentUserName('');
                  setShowNamePrompt(true);
                }
              }, 500);
            }
          } else {
            setTimeout(checkAndClaimPosts, 100);
          }
        };
        checkAndClaimPosts();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchItems]);
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setIsImageMarkedForDeletion(false);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleNameSave = (name: string) => {
    if (!currentRoom) return;
    const trimmedName = name.trim();
    if (trimmedName) {
      localStorage.setItem(`taskino_username_${currentRoom.id}`, trimmedName);
      setCurrentUserName(trimmedName);
      setShowNamePrompt(false);
      resetForm(trimmedName); 
    }
  };

  const handleImageDelete = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setIsImageMarkedForDeletion(true);
  };
  
  const resetForm = (nameToSet?: string) => {
    // localStorageに保存されたルームごとの名前を最優先で使う
    const name = currentUserName || session?.user?.user_metadata?.name || session?.user?.email || '';

    setNewItem({ 
      title: '', 
      description: '', 
      category: 'go', 
      location: { name: '', address: '' }, 
      start_at: '', 
      end_at: '', 
      createdBy: name
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsImageMarkedForDeletion(false);
    setShowTimeInputs(false);
    setIsRange(false);
  }

  const handleLikeToggle = async (itemId: string) => {
    if (!session?.user) {
      alert('Please log in to like items.');
      return;
    }
    const userId = session.user.id;
    const existingLike = likes[itemId]?.find(like => like.user_id === userId);

    if (existingLike) {
      await supabase.from('likes').delete().eq('id', existingLike.id);
    } else {
      await supabase.from('likes').insert({ item_id: itemId, user_id: userId });
    }
    await fetchLikesForItems([itemId]);
  };

  const filteredItems = items.filter(item => 
    (selectedCategory === 'all' || item.category === selectedCategory) &&
    (item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
     item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.location?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getCategoryIcon = (category: string) => {
    return categories.find(cat => cat.id === category)?.icon || Search;
  };
  
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  if (loading && items.length === 0) return <div className="loading-screen"><p>Loading...</p></div>;
  if (error) return <div className="error-screen"><h2>Error</h2><p>{error}</p></div>;

  return (
    <div className="taskino-app-container">
      <header className="app-header">
        <div className="header-container">
          <div className="header-title-group">
            <button onClick={() => navigate('/')} className="header-back-button">←</button>
            <div className="header-title">
              <span className="header-logo-text">taskino</span>
              {currentRoom && <span className="header-room-name">- {currentRoom.name}</span>}
            </div>
          </div>
          <div className="header-actions">
            <button onClick={() => {
                const shareUrl = `${window.location.origin}/room/${shareCode}`;
                navigator.clipboard.writeText(shareUrl).then(() => alert('Share URL copied to clipboard!'));
              }}
              className="header-action-button share-button"
              title="Copy share link"
            >
              <Share2 size={16} />
              <span className="action-button-text">Share</span>
            </button>
            <button onClick={() => setShowArchived(!showArchived)} className={`header-action-button ${showArchived ? 'archive-button-active' : ''}`} title={showArchived ? 'View Active Items' : 'View Archived Items'}>
              <Archive size={16} />
              <span className="action-button-text">{showArchived ? 'Active' : 'Archive'}</span>
            </button>
            {session ? (
              <button onClick={handleLogout} className="header-action-button auth-button">
                <LogIn size={16} style={{ transform: 'rotate(180deg)' }} />
                <span className="action-button-text">Logout</span>
              </button>
            ) : (
              <button onClick={handleLogin} className="header-action-button auth-button">
                <UserCircle size={16} />
                <span className="action-button-text">Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="content-wrapper">
        <div className="fixed-content">
          <div className="search-bar-container">
            <Search size={20} className="search-icon" />
            <input type="text" placeholder="Search items" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
          </div>
          <div className="category-filters">
            {categories.map((category) => (
              <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={`category-button ${selectedCategory === category.id ? 'active' : ''}`}>
                <category.icon size={16} />
                <span>{category.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="scrollable-content">
          <div className="items-grid">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setEditingItem(item);
                  setNewItem({
                    title: item.title, description: item.description || '', category: item.category,
                    location: item.location || { name: '', address: '' },
                    start_at: item.start_at ? new Date(item.start_at).toISOString().slice(0, 16) : '',
                    end_at: item.end_at ? new Date(item.end_at).toISOString().slice(0, 16) : '',
                    createdBy: item.created_by || ''
                  });
                  setPreviewUrl(item.image_url || null);
                  setSelectedFile(null);
                  setIsImageMarkedForDeletion(false);
                  setShowTimeInputs(!!(item.start_at && new Date(item.start_at).toTimeString().slice(0, 5) !== '00:00'));
                  setIsRange(!!item.end_at);
                  setIsEditModalOpen(true);
                }}
                className={`item-card ${item.completed ? 'completed' : ''}`}
              >
                {item.image_url && <img src={item.image_url} alt={item.title} className="item-card-image" />}
                <div className="item-card-header">
                  <div className="item-card-category">
                    <div className="item-card-category-icon">{React.createElement(getCategoryIcon(item.category), { size: 16, color: '#CD7213' })}</div>
                    <span className="item-card-category-label">{categories.find(cat => cat.id === item.category)?.label}</span>
                  </div>
                  <div onClick={async (e) => { e.stopPropagation(); await supabase.from('taskino_items').update({ completed: !item.completed }).eq('id', item.id); }} className={`item-card-completion ${item.completed ? 'completed' : 'incomplete'}`} title={item.completed ? 'Mark as incomplete' : 'Mark as complete'}>
                    <div className="completion-checkbox">{item.completed && '✓'}</div>
                    <span className="completion-text">{item.completed ? 'Done' : 'Mark Done'}</span>
                  </div>
                </div>
                <h3 className="item-card-title">{item.title}</h3>
                {item.description && <p className="item-card-description">{item.description}</p>}
                <div className="item-card-meta">
                  {item.location?.name && <div className="meta-info location"><MapPin size={14} /><span>{item.location.name}</span></div>}
                  {item.start_at && (
                    <div className="meta-info deadline">
                      <Calendar size={14} />
                      <span>
                        {new Date(item.start_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {new Date(item.start_at).toTimeString().slice(0, 5) !== '00:00' && ` ${new Date(item.start_at).toTimeString().slice(0, 5)}`}
                        {item.end_at && ` - ${new Date(item.end_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        {item.end_at && new Date(item.end_at).toTimeString().slice(0, 5) !== '00:00' && ` ${new Date(item.end_at).toTimeString().slice(0, 5)}`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="item-card-footer">
                  <span className="footer-created-by">{item.created_by} added</span>
                  <div className="like-container">
                    <button onClick={(e) => { e.stopPropagation(); handleLikeToggle(item.id); }} className={`like-button ${likes[item.id]?.some(like => like.user_id === session?.user?.id) ? 'liked' : ''}`}>
                      ❤️
                    </button>
                    <span className="like-count">{likes[item.id]?.length || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filteredItems.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3 className="empty-state-title">{showArchived ? 'Archive is empty' : 'No items found'}</h3>
              <p className="empty-state-text">{showArchived ? 'There are no archived items.' : 'Please add a new item or change filters.'}</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Add New Item</h2>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="modal-close-button">×</button>
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Title *</label>
              <input type="text" value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} className="modal-input" />
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Category *</label>
              <div className="modal-category-selector">
                {categories.slice(1).map((category) => (
                  <button key={category.id} onClick={() => setNewItem({ ...newItem, category: category.id as any })} className={`modal-category-button ${newItem.category === category.id ? 'active' : ''}`}>
                    <category.icon size={14} />{category.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Description</label>
              <textarea value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} className="modal-textarea" />
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Image</label>
              {previewUrl && <img src={previewUrl} alt="Preview" className="modal-image-preview" />}
              <label htmlFor="file-upload" className="modal-file-input-label">{uploading ? 'Uploading...' : 'Select Image'}</label>
              <input id="file-upload" type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} disabled={uploading} />
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Place</label>
              <input type="text" value={newItem.location.name} onChange={(e) => setNewItem({ ...newItem, location: { ...newItem.location, name: e.target.value } })} className="modal-input" />
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Date & Time</label>
              <div className="date-time-container">
                <input type="date" value={newItem.start_at ? newItem.start_at.split('T')[0] : ''} onChange={(e) => { const timePart = newItem.start_at?.split('T')[1] || ''; setNewItem({ ...newItem, start_at: e.target.value ? `${e.target.value}${timePart ? `T${timePart}` : ''}` : '' }); }} className="modal-input" />
                {showTimeInputs && <input type="time" value={newItem.start_at ? newItem.start_at.split('T')[1] : ''} onChange={(e) => { const datePart = newItem.start_at?.split('T')[0] || new Date().toISOString().split('T')[0]; setNewItem({ ...newItem, start_at: `${datePart}T${e.target.value}` }); }} className="modal-input" />}
              </div>
              <div className="date-time-toggles">
                <label><input type="checkbox" checked={showTimeInputs} onChange={(e) => setShowTimeInputs(e.target.checked)} /> Add Time</label>
                <label><input type="checkbox" checked={isRange} onChange={(e) => setIsRange(e.target.checked)} /> Add End Date</label>
              </div>
              {isRange && (
                <div className="date-time-container" style={{ marginTop: '10px' }}>
                  <input type="date" value={newItem.end_at ? newItem.end_at.split('T')[0] : ''} onChange={(e) => { const timePart = newItem.end_at?.split('T')[1] || ''; setNewItem({ ...newItem, end_at: e.target.value ? `${e.target.value}${timePart ? `T${timePart}` : ''}` : '' }); }} className="modal-input" />
                  {showTimeInputs && <input type="time" value={newItem.end_at ? newItem.end_at.split('T')[1] : ''} onChange={(e) => { const datePart = newItem.end_at?.split('T')[0] || newItem.start_at?.split('T')[0] || new Date().toISOString().split('T')[0]; setNewItem({ ...newItem, end_at: `${datePart}T${e.target.value}` }); }} className="modal-input" />}
                </div>
              )}
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Your name *</label>
              <input type="text" value={newItem.createdBy} onChange={(e) => setNewItem({ ...newItem, createdBy: e.target.value })} className="modal-input" disabled={!!(session || currentUserName)} />
            </div>
            <div className="modal-actions end">
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="modal-button secondary">Cancel</button>
              <button onClick={async () => {
                if (!newItem.title.trim() || !newItem.createdBy.trim()) return;
                try {
                  setUploading(true);
                  let imageUrl: string | null = null;
                  if (selectedFile) {
                    const fileExt = selectedFile.name.split('.').pop();
                    const filePath = `${Date.now()}.${fileExt}`;
                    await supabase.storage.from('taskino_images').upload(filePath, selectedFile);
                    const { data: urlData } = supabase.storage.from('taskino_images').getPublicUrl(filePath);
                    imageUrl = urlData.publicUrl;
                  }
                  const { title, description, category, location, start_at, end_at, createdBy } = newItem;
                  const insertData = { title, description, category, location: location.name ? location : null, start_at: start_at || null, end_at: isRange ? (end_at || null) : null,  created_by: createdBy, room_id: currentRoom?.id, image_url: imageUrl };
                  await supabase.from('taskino_items').insert([insertData]).select();
                  setIsModalOpen(false);
                  resetForm();
                } catch (error: any) { alert('Error: ' + error.message); } finally { setUploading(false); }
              }}
                className="modal-button primary"
                disabled={!newItem.title.trim() || !newItem.createdBy.trim() || uploading}
              >
                {uploading ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editingItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Edit Item</h2>
              <button onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }} className="modal-close-button">×</button>
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Title *</label>
              <input type="text" value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} className="modal-input" />
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Category *</label>
              <div className="modal-category-selector">
                {categories.slice(1).map((category) => (
                  <button key={category.id} onClick={() => setNewItem({ ...newItem, category: category.id as any })} className={`modal-category-button ${newItem.category === category.id ? 'active' : ''}`}>
                    <category.icon size={14} />{category.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Description</label>
              <textarea value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} className="modal-textarea" />
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Image</label>
              {previewUrl && <img src={previewUrl} alt="Preview" className="modal-image-preview" />}
              <div className="image-edit-actions">
                {previewUrl ? (
                  <>
                    <label htmlFor="file-upload-edit" className="modal-button secondary small">Replace</label>
                    <button onClick={handleImageDelete} className="modal-button danger small">Delete</button>
                  </>
                ) : (
                  <label htmlFor="file-upload-edit" className="modal-button primary small">Add Image</label>
                )}
              </div>
              <input id="file-upload-edit" type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} disabled={uploading} />
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Place</label>
              <input type="text" value={newItem.location.name} onChange={(e) => setNewItem({ ...newItem, location: { ...newItem.location, name: e.target.value } })} className="modal-input" />
            </div>
            {newItem.location?.name && googleMapsApiKey && (
              <div className="modal-map-container">
                <iframe
                  title={`Map of ${newItem.location.name}`}
                  width="100%"
                  height="250"
                  style={{ border: 0, borderRadius: '8px' }}
                  loading="lazy"
                  allowFullScreen
                  src={`https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodeURIComponent(newItem.location.name)}`}
                ></iframe>
              </div>
            )}
            <div className="modal-form-group">
              <label className="modal-label">Date & Time</label>
              <div className="date-time-container">
                <input type="date" value={newItem.start_at ? newItem.start_at.split('T')[0] : ''} onChange={(e) => { const timePart = newItem.start_at?.split('T')[1] || ''; setNewItem({ ...newItem, start_at: e.target.value ? `${e.target.value}${timePart ? `T${timePart}` : ''}` : '' }); }} className="modal-input" />
                {showTimeInputs && <input type="time" value={newItem.start_at ? newItem.start_at.split('T')[1] : ''} onChange={(e) => { const datePart = newItem.start_at?.split('T')[0] || new Date().toISOString().split('T')[0]; setNewItem({ ...newItem, start_at: `${datePart}T${e.target.value}` }); }} className="modal-input" />}
              </div>
              <div className="date-time-toggles">
                <label><input type="checkbox" checked={showTimeInputs} onChange={(e) => setShowTimeInputs(e.target.checked)} /> Add Time</label>
                <label><input type="checkbox" checked={isRange} onChange={(e) => setIsRange(e.target.checked)} /> Add End Date</label>
              </div>
              {isRange && (
                <div className="date-time-container" style={{ marginTop: '10px' }}>
                  <input type="date" value={newItem.end_at ? newItem.end_at.split('T')[0] : ''} onChange={(e) => { const timePart = newItem.end_at?.split('T')[1] || ''; setNewItem({ ...newItem, end_at: e.target.value ? `${e.target.value}${timePart ? `T${timePart}` : ''}` : '' }); }} className="modal-input" />
                  {showTimeInputs && <input type="time" value={newItem.end_at ? newItem.end_at.split('T')[1] : ''} onChange={(e) => { const datePart = newItem.end_at?.split('T')[0] || newItem.start_at?.split('T')[0] || new Date().toISOString().split('T')[0]; setNewItem({ ...newItem, end_at: `${datePart}T${e.target.value}` }); }} className="modal-input" />}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <div className="modal-actions-left">
                <button
                  onClick={async () => {
                    if (!editingItem) return;
                    if (window.confirm(showArchived ? 'Permanently delete this item?' : 'Archive this item?')) {
                      try {
                        if (showArchived) {
                          await supabase.from('taskino_items').delete().eq('id', editingItem.id);
                        } else {
                          await supabase.from('taskino_items').update({ archived: true }).eq('id', editingItem.id);
                        }
                        setIsEditModalOpen(false);
                      } catch (error) { alert('Operation failed.'); }
                    }
                  }}
                  className="modal-button danger"
                >
                  {showArchived ? 'Delete' : 'Archive'}
                </button>
                {showArchived && (
                  <button onClick={async () => {
                    if (!editingItem) return;
                      try {
                        await supabase.from('taskino_items').update({ archived: false }).eq('id', editingItem.id);
                        setIsEditModalOpen(false);
                      } catch (error) { alert('Restore failed.'); }
                    }}
                    className="modal-button success"
                  >
                    Restore
                  </button>
                )}
              </div>
              <div className="modal-actions-right">
                <button onClick={() => {setIsEditModalOpen(false); setEditingItem(null);}} className="modal-button secondary">Cancel</button>
                <button
                 onClick={async () => {
                    if (!newItem.title.trim() || !editingItem) return;
                    try {
                      setUploading(true);
                      let imageUrl: string | undefined | null = editingItem.image_url;
                      if (isImageMarkedForDeletion) {
                        imageUrl = null;
                      } else if (selectedFile) {
                        const fileExt = selectedFile.name.split('.').pop();
                        const filePath = `${Date.now()}.${fileExt}`;
                        await supabase.storage.from('taskino_items').upload(filePath, selectedFile);
                        const { data: urlData } = supabase.storage.from('taskino_images').getPublicUrl(filePath);
                        imageUrl = urlData.publicUrl;
                      }
                      const { title, description, category, location, start_at, end_at } = newItem;
                      const updateData = { title, description, category, location: location.name ? location : null, start_at: start_at || null, end_at: isRange ? (end_at || null) : null,  image_url: imageUrl };
                      const { error } = await supabase.from('taskino_items').update(updateData).eq('id', editingItem.id);
                      if (error) throw error;
                      await fetchItems(showArchived);
                      setIsEditModalOpen(false);
                    } catch (error: any) {
                      alert('Update failed: ' + error.message);
                    } finally {
                      setUploading(false);
                    }
                  }}
                  className="modal-button primary"
                  disabled={!newItem.title.trim() || uploading}
                >
                  {uploading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showNamePrompt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Welcome!</h2>
            </div>
            <p style={{ color: '#555', marginTop: 0, marginBottom: '20px' }}>
              Please enter the name you'd like to use in this room.
            </p>
            <div className="modal-form-group">
              <label className="modal-label">Your Name</label>
              <input type="text" className="modal-input" placeholder="Enter your name" onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) handleNameSave(e.currentTarget.value);
                }} />
            </div>
            <div className="modal-actions end">
              <button
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.parentElement?.querySelector('input');
                  if (input && input.value.trim()) handleNameSave(input.value);
                }}
                className="modal-button primary"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

<button onClick={() => {
          resetForm(); // 引数なしで呼ぶ
          setIsModalOpen(true);
        }}
        className="fab"
      >
        <Plus size={20} color="#002C54" /> Add
      </button>
    </div>
  );
}

function RoomSelector() {
  const [newRoomName, setNewRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const navigate = useNavigate();

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const shareCode = Math.random().toString(36).substring(2, 8);
      const { data, error } = await supabase.from('rooms').insert([{ name: newRoomName, share_code: shareCode }]).select();
      if (error) throw error;
      if (data) navigate(`/room/${data[0].share_code}`);
    } catch (error) {
      console.error('Room creation error:', error);
    }
  };

  const joinRoom = () => {
    if (joinCode.trim()) navigate(`/room/${joinCode}`);
  };

  return (
    <div className="room-selector-container">
      <h1 className="app-title">taskino</h1>
      <div className="room-selector-box">
        <h2>Create New Room</h2>
        <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Enter room name" className="room-selector-input" />
        <button onClick={createRoom} className="room-selector-button">Create</button>
      </div>
      <div className="room-selector-box">
        <h2>Join Room</h2>
        <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Enter share code" className="room-selector-input" />
        <button onClick={joinRoom} className="room-selector-button">Join</button>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoomSelector />} />
        <Route path="/room/:shareCode" element={<TaskinoApp />} />
      </Routes>
    </Router>
  );
}

export default App;