import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar, Search, UtensilsCrossed, ShoppingBag, Palette, CheckSquare, Share2, QrCode, Archive } from 'lucide-react';
import QRCode from 'qrcode';
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
}
interface Room {
  id: string;
  name: string;
  share_code: string;
  created_at: string;
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

// QRコード表示用のコンポーネント
function QRCodeComponent({ shareCode, currentRoom }: { shareCode?: string, currentRoom: Room | null }) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (shareCode && currentRoom) {
      const shareUrl = `${window.location.origin}/room/${shareCode}`;
      QRCode.toDataURL(shareUrl, {
        width: 256, margin: 2, color: { dark: '#002C54', light: '#FFFFFF' }
      }).then(url => setQrCodeUrl(url));
    }
  }, [shareCode, currentRoom]);

  if (!qrCodeUrl) return <div className="loading-text">Generating QR Code...</div>;

  return (
    <div>
      <img src={qrCodeUrl} alt="QR Code" style={{ width: '256px', height: '256px' }} />
      <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
        Share this QR code to join the room.
      </p>
      <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
        Room: {currentRoom?.name}
      </p>
    </div>
  );
}

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
  
  const [newItem, setNewItem] = useState({
    title: '', description: '', category: 'go' as 'go' | 'eat' | 'buy' | 'do' | 'other',
    location: { name: '', address: '' }, start_at: '', end_at: '', createdBy: ''
  });

  const [showQR, setShowQR] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isImageMarkedForDeletion, setIsImageMarkedForDeletion] = useState(false);

  const fetchItems = useCallback(async (archived = false) => {
    if (!currentRoom) return;
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('taskino_items')
        .select('*')
        .eq('room_id', currentRoom.id)
        .eq('archived', archived)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setItems(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentRoom]);

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
    if (currentRoom) {
      fetchItems(showArchived);
    }
  }, [currentRoom, showArchived, fetchItems]);
  
  useEffect(() => {
    if (!currentRoom) return;
    const channel = supabase
      .channel(`room_${currentRoom.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taskino_items', filter: `room_id=eq.${currentRoom.id}` },
        () => fetchItems(showArchived)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom, showArchived, fetchItems]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setIsImageMarkedForDeletion(false);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleImageDelete = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setIsImageMarkedForDeletion(true);
  };
  
  const resetForm = () => {
    setNewItem({ title: '', description: '', category: 'go', location: { name: '', address: '' }, start_at: '', end_at: '', createdBy: '' });
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsImageMarkedForDeletion(false);
  }

  const filteredItems = items.filter(item => 
    (selectedCategory === 'all' || item.category === selectedCategory) &&
    (item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
     item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.location?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getCategoryIcon = (category: string) => {
    return categories.find(cat => cat.id === category)?.icon || Search;
  };

  if (loading && items.length === 0) {
    return <div className="loading-screen"><p>Loading...</p></div>;
  }
  if (error) {
    return <div className="loading-screen"><h2>Error</h2><p>{error}</p></div>;
  }

  return (
    <div className="taskino-app-container">
      <header className="app-header">
        <div className="header-container">
          <div className="header-title-group">
            <button onClick={() => navigate('/')} className="header-back-button">
              ← BACK
            </button>
            <div className="header-title">taskino</div>
          </div>
          <div className="header-actions">
            <button onClick={() => setShowQR(!showQR)} className="header-action-button" title="Share QR Code">
              <QrCode size={18} />
            </button>
            <button
              onClick={() => {
                const shareUrl = `${window.location.origin}/room/${shareCode}`;
                navigator.clipboard.writeText(shareUrl).then(() => {
                  alert('Share URL copied to clipboard!');
                });
              }}
              className="header-action-button share-button"
            >
              <Share2 size={14} />
              <span className="action-button-text">Share</span>
            </button>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`header-action-button ${showArchived ? 'archive-button-active' : ''}`}
              title={showArchived ? 'View Active Items' : 'View Archived Items'}
            >
              <Archive size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className="search-bar-container">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search items"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="category-filters">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`category-button ${selectedCategory === category.id ? 'active' : ''}`}
            >
              <category.icon size={16} />
              <span>{category.label}</span>
            </button>
          ))}
        </div>

        <div className="items-grid">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setEditingItem(item);
                setNewItem({
                  title: item.title,
                  description: item.description || '',
                  category: item.category,
                  location: item.location || { name: '', address: '' },
                  start_at: item.start_at ? new Date(item.start_at).toISOString().slice(0, 16) : '',
                  end_at: item.end_at ? new Date(item.end_at).toISOString().slice(0, 16) : '',
                  createdBy: item.created_by || ''
                });
                setPreviewUrl(item.image_url || null);
                setSelectedFile(null);
                setIsImageMarkedForDeletion(false);
                setIsEditModalOpen(true);
              }}
              className={`item-card ${item.completed ? 'completed' : ''}`}
            >
              {item.image_url && (
                <img src={item.image_url} alt={item.title} className="item-card-image" />
              )}
              <div className="item-card-header">
                <div className="item-card-category">
                  <div className="item-card-category-icon">
                    {React.createElement(getCategoryIcon(item.category), { size: 16, color: '#CD7213' })}
                  </div>
                  <span className="item-card-category-label">
                    {categories.find(cat => cat.id === item.category)?.label}
                  </span>
                </div>
                <div
                  onClick={async (e) => {
                    e.stopPropagation();
                    await supabase.from('taskino_items').update({ completed: !item.completed }).eq('id', item.id);
                  }}
                  className="item-card-checkbox"
                >
                  {item.completed && '✓'}
                </div>
              </div>
              <h3 className="item-card-title">{item.title}</h3>
              {item.description && (
                <p className="item-card-description">{item.description}</p>
              )}
              <div className="item-card-meta">
                {item.location && <div className="meta-info location"><MapPin size={14} /><span>{item.location.name}</span></div>}
                {item.start_at && (
                  <div className="meta-info deadline">
                    <Calendar size={14} />
                    <span>
                      {new Date(item.start_at).toLocaleDateString('ja-JP')}
                      {new Date(item.start_at).toTimeString().slice(0, 5) !== '00:00' && ` ${new Date(item.start_at).toTimeString().slice(0, 5)}`}
                    </span>
                  </div>
                )}
              </div>
              <div className="item-card-footer">
                <span className="footer-created-by">{item.created_by} added</span>
                <span className="footer-created-at">{item.created_at}</span>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 className="empty-state-title">{showArchived ? 'Archive is empty' : 'No items found'}</h3>
            <p className="empty-state-text">
              {showArchived ? 'There are no archived items.' : 'Please add a new item or change filters.'}
            </p>
          </div>
        )}
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
                    <category.icon size={14} />
                    {category.label}
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
            <div className="modal-form-group-inline">
              <div style={{ flex: 2 }}>
                <label className="modal-label">Date</label>
                <input
                  type="date"
                  value={newItem.start_at ? newItem.start_at.split('T')[0] : ''}
                  onChange={(e) => {
                    const timePart = newItem.start_at?.split('T')[1] || '';
                    setNewItem({ ...newItem, start_at: e.target.value ? `${e.target.value}${timePart ? `T${timePart}` : ''}` : '' });
                  }}
                  className="modal-input"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="modal-label">Time (Opt)</label>
                <input
                  type="time"
                  value={newItem.start_at ? newItem.start_at.split('T')[1] : ''}
                  onChange={(e) => {
                    const datePart = newItem.start_at?.split('T')[0];
                    if (datePart) {
                      setNewItem({ ...newItem, start_at: `${datePart}T${e.target.value}` });
                    }
                  }}
                  className="modal-input"
                />
              </div>
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Your name *</label>
              <input type="text" value={newItem.createdBy} onChange={(e) => setNewItem({ ...newItem, createdBy: e.target.value })} className="modal-input" />
            </div>
            <div className="modal-actions end">
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="modal-button secondary">Cancel</button>
              <button
                onClick={async () => {
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
                    const insertData = { title, description, category, location: location.name ? location : null, start_at: start_at || null, end_at: end_at || null, created_by: createdBy, room_id: currentRoom?.id, image_url: imageUrl };
                    await supabase.from('taskino_items').insert([insertData]).select();
                    setIsModalOpen(false);
                    resetForm();
                  } catch (error: any) {
                    alert('Error: ' + error.message);
                  } finally {
                    setUploading(false);
                  }
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
              <button onClick={() => {setIsEditModalOpen(false); setEditingItem(null);}} className="modal-close-button">×</button>
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
                    <category.icon size={14} />
                    {category.label}
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
                    <label htmlFor="file-upload-edit" className="modal-button secondary small">Replace Image</label>
                    <button onClick={handleImageDelete} className="modal-button danger small">Delete Image</button>
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
            {newItem.location.name && (
              <div className="modal-map-container">
                <iframe
                  title={`Map of ${newItem.location.name}`}
                  width="100%"
                  height="250"
                  style={{ border: 0, borderRadius: '8px' }}
                  loading="lazy"
                  allowFullScreen
                  src={`https://www.google.com/maps/embed/v1/place?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(newItem.location.name)}`}
                ></iframe>
              </div>
            )}
            <div className="modal-form-group-inline">
              <div style={{ flex: 2 }}>
                <label className="modal-label">Date</label>
                <input
                  type="date"
                  value={newItem.start_at ? newItem.start_at.split('T')[0] : ''}
                  onChange={(e) => {
                    const timePart = newItem.start_at?.split('T')[1] || '';
                    setNewItem({ ...newItem, start_at: e.target.value ? `${e.target.value}${timePart ? `T${timePart}` : ''}` : '' });
                  }}
                  className="modal-input"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="modal-label">Time (Opt)</label>
                <input
                  type="time"
                  value={newItem.start_at ? newItem.start_at.split('T')[1] : ''}
                  onChange={(e) => {
                    const datePart = newItem.start_at?.split('T')[0];
                    if (datePart) {
                      setNewItem({ ...newItem, start_at: `${datePart}T${e.target.value}` });
                    }
                  }}
                  className="modal-input"
                />
              </div>
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
                        await supabase.storage.from('taskino_images').upload(filePath, selectedFile);
                        const { data: urlData } = supabase.storage.from('taskino_images').getPublicUrl(filePath);
                        imageUrl = urlData.publicUrl;
                      }
                      const { title, description, category, location, start_at, end_at } = newItem;
                      const updateData = { title, description, category, location: location.name ? location : null, start_at: start_at || null, end_at: end_at || null, image_url: imageUrl };
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
      
      {showQR && (
        <div className="modal-overlay">
          <div className="modal-content qr-modal">
            <div className="modal-header">
              <h2 className="modal-title">Share with QR Code</h2>
              <button onClick={() => setShowQR(false)} className="modal-close-button">×</button>
            </div>
            <QRCodeComponent shareCode={shareCode} currentRoom={currentRoom} />
          </div>
        </div>
      )}

      <button onClick={() => {
          resetForm();
          setIsModalOpen(true);
        }}
        className="fab"
      >
        <Plus size={20} color="#002C54" />
        Add
      </button>
    </div>
  );
}

// Room Selector
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
      console.error('room create error:', error);
    }
  };

  const joinRoom = () => {
    if (joinCode.trim()) {
      navigate(`/room/${joinCode}`);
    }
  };

  return (
    <div className="room-selector-container">
      <h1 className="app-title">taskino</h1>
      <div className="room-selector-box">
        <h2>Create New Room</h2>
        <input
          type="text"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          placeholder="Enter room name"
          className="room-selector-input"
        />
        <button onClick={createRoom} className="room-selector-button">Create</button>
      </div>
      <div className="room-selector-box">
        <h2>Join Room</h2>
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Enter share code"
          className="room-selector-input"
        />
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