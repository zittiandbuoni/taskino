import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar, Search, UtensilsCrossed, ShoppingBag, Palette, CheckSquare, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from './supabase';
import './App.css';

declare global {
  interface Window {
    google: any;
  }
}

interface TaskinoItem {
  id: string;
  title: string;
  description?: string;
  category: 'go' | 'eat' | 'buy' | 'do' | 'other';
  location?: {
    name: string;
    address: string;
  };
  completed: boolean;
  deadline?: string;
  created_by: string;
  created_at: string;
}
interface Room {
  id: string;
  name: string;
  share_code: string;
  created_at: string;
}
const categories = [
  { id: 'all', label: 'All', icon: Search, color: '#EFB509' },
  { id: 'go', label: 'To Go', icon: MapPin, color: '#EFB509' },
  { id: 'eat', label: 'To Eat', icon: UtensilsCrossed, color: '#EFB509' },
  { id: 'buy', label: 'To Buy', icon: ShoppingBag, color: '#EFB509' },
  { id: 'do', label: 'To Do', icon: CheckSquare, color: '#EFB509' },
  { id: 'other', label: 'Other', icon: Palette, color: '#EFB509' },
];
function QRCodeComponent({ shareCode, currentRoom }: { shareCode?: string, currentRoom: Room | null }) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (shareCode && currentRoom) {
      const shareUrl = `${window.location.origin}/room/${shareCode}`;
      QRCode.toDataURL(shareUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#002C54',
          light: '#FFFFFF'
        }
      }).then(url => {
        setQrCodeUrl(url);
      });
    }
  }, [shareCode, currentRoom]);

  if (!qrCodeUrl) {
    return <div>Generating QR Code...</div>;
  }

  return (
    <div>
      <img src={qrCodeUrl} alt="QR Code" style={{ width: '256px', height: '256px' }} />
      <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
        Share this QR code to join the room
      </p>
      <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
        room: {currentRoom?.name}
      </p>
    </div>
  );
}
function TaskinoApp() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    category: 'go' as 'go' | 'eat' | 'buy' | 'do' | 'other',
    location: { name: '', address: '' },
    deadline: '',
    createdBy: ''
  });
  
  const [items, setItems] = useState<TaskinoItem[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
  
  const [editingItem, setEditingItem] = useState<TaskinoItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // fetch data from Supabase
  const fetchItems = async () => {
    if (!currentRoom) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
       .from('taskino_items')
       .select('*')
       .eq('room_id', currentRoom.id)
       .eq('archived', false)
       .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedItems = data?.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      location: item.location,
      completed: item.completed,
      deadline: item.deadline ? new Date(item.deadline).toISOString().split('T')[0] : undefined,
      created_by: item.created_by,
      created_at: new Date(item.created_at).toISOString().split('T')[0]
    })) || [];

    setItems(formattedItems);
  } catch (error: any) {
    console.error('failed to fetch data', error);
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
<button 
  onClick={async () => {
    console.log('archive button clicked');
    const newShowArchived = !showArchived;
    setShowArchived(newShowArchived);
    
    if (newShowArchived) {
      try {
        setLoading(true);
        console.log('archive items fetch started', currentRoom?.id);
        const { data, error } = await supabase
          .from('taskino_items')
          .select('*')
          .eq('room_id', currentRoom?.id)
          .eq('archived', true)
          .order('created_at', { ascending: false });
  
        console.log('archive items fetch result:', { data, error }); // ← この行を追加
  
        if (error) throw error;
  
        const formattedItems = data?.map((item: any) => ({
          ...item,
          created_at: new Date(item.created_at).toISOString().split('T')[0],
          deadline: item.deadline ? new Date(item.deadline).toISOString().split('T')[0] : undefined
        })) || [];
  
        console.log('archive items formatted:', formattedItems); // ← この行を追加
        setItems(formattedItems);
      } catch (error: any) {
        console.error('archive items fetch failed:', error);
      } finally {
        setLoading(false);
      }
    } else {
      fetchItems();
    }
  }}
    style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: showArchived ? '#EFB509' : 'rgba(255, 255, 255, 0.2)',
    color: showArchived ? '#002C54' : 'white',
    border: 'none',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginLeft: '8px'
  }}
>
  📁 {showArchived ? 'Normal' : 'Archive'}
</button>
const fetchRoom = async () => {
  if (!shareCode) return;
  
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('share_code', shareCode)
      .single();
    
    if (error) throw error;
    setCurrentRoom(data);
  } catch (error) {
    console.error('room fetch error:', error);
    setError('room not found');
  }
};

useEffect(() => {
  fetchRoom();
}, [shareCode]);

useEffect(() => {
  if (currentRoom) {
    fetchItems();
  }
}, [currentRoom]);
// realtime subscription
useEffect(() => {
  if (!currentRoom) return;

  const subscription = supabase
    .channel(`room_${currentRoom.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'taskino_items',
        filter: `room_id=eq.${currentRoom.id}`
      },
      (payload) => {
        console.log('realtime update:', payload);
        
        if (payload.eventType === 'INSERT') {
          const newItem = {
            ...payload.new,
            created_at: new Date(payload.new.created_at).toISOString().split('T')[0],
            deadline: payload.new.deadline ? new Date(payload.new.deadline).toISOString().split('T')[0] : undefined
          } as TaskinoItem;
          
          setItems(prevItems => {
            // duplicate check
            if (prevItems.some(item => item.id === newItem.id)) {
              return prevItems;
            }
            return [newItem, ...prevItems];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedItem = {
            ...payload.new,
            created_at: new Date(payload.new.created_at).toISOString().split('T')[0],
            deadline: payload.new.deadline ? new Date(payload.new.deadline).toISOString().split('T')[0] : undefined
          } as TaskinoItem;
          
          setItems(prevItems => 
            prevItems.map(item => 
              item.id === updatedItem.id ? updatedItem : item
            )
          );
        } else if (payload.eventType === 'DELETE') {
          setItems(prevItems => 
            prevItems.filter(item => item.id !== payload.old.id)
          );
        }
      }
    )
    .subscribe();

  // cleanup
  return () => {
    subscription.unsubscribe();
  };
}, [currentRoom]);
// error display
if (error) {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#16253D',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#EFB509', marginBottom: '16px' }}>Error</h2>
        <p>{error}</p>
        <button onClick={() => { setError(null); fetchItems(); }}>Retry</button>
      </div>
    </div>
  );
}

// loading display
if (loading) {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#16253D',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white'
    }}>
      <p>Loading...</p>
    </div>
  );
}

  const filteredItems = items.filter(item => {
    const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
    const searchMatch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return categoryMatch && searchMatch;
  });

  const getCategoryIcon = (category: string) => {
    const categoryData = categories.find(cat => cat.id === category);
    return categoryData?.icon || Search;
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#16253D',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
{/* Header */}
<header style={{ 
  position: 'sticky',
  top: 0,
  zIndex: 50,
  padding: '16px',
  backgroundColor: '#002C54',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
}}>
  <div style={{ 
    maxWidth: '1024px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <button 
        onClick={() => navigate('/')}
        style={{
          padding: '8px',
          color: 'rgba(255, 255, 255, 0.8)',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        ← BACK
      </button>
      <div style={{ 
        fontSize: '28px',
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: '-0.5px'
      }}>taskino</div>
    </div>
    
    {/* button group */}
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      flexWrap: 'wrap'
    }}>
      <button 
        onClick={() => {
          console.log('QR button clicked');
          setShowQR(!showQR);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: 'none',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        📱
      </button>
      
      <button 
        onClick={() => {
          const shareUrl = `${window.location.origin}/room/${shareCode}`;
          navigator.clipboard.writeText(shareUrl).then(() => {
            alert('Share URL copied to clipboard!');
          }).catch(() => {
            prompt('Please copy the following url:', shareUrl);
          });
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          backgroundColor: '#EFB509',
          color: '#002C54',
          border: 'none',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        <Share2 size={14} />
        Share
      </button>
      
      <button 
        onClick={async () => {
          const newShowArchived = !showArchived;
          setShowArchived(newShowArchived);
          
          if (newShowArchived) {
            try {
              setLoading(true);
              console.log('archive items fetch started', currentRoom?.id);
              const { data, error } = await supabase
                .from('taskino_items')
                .select('*')
                .eq('room_id', currentRoom?.id)
                .eq('archived', true)
                .order('created_at', { ascending: false });

              console.log('archive items fetch result:', { data, error });

              if (error) throw error;

              const formattedItems = data?.map((item: any) => ({
                ...item,
                created_at: new Date(item.created_at).toISOString().split('T')[0],
                deadline: item.deadline ? new Date(item.deadline).toISOString().split('T')[0] : undefined
              })) || [];

              console.log('formatted items:', formattedItems);
              setItems(formattedItems);
            } catch (error: any) {
              console.error('archive items fetch failed:', error);
            } finally {
              setLoading(false);
            }
          } else {
            fetchItems();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          backgroundColor: showArchived ? '#EFB509' : 'rgba(255, 255, 255, 0.2)',
          color: showArchived ? '#002C54' : 'white',
          border: 'none',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        📁
      </button>
    </div>
  </div>
</header>

    <div className="main-content"> 
{/* Search Bar */}
<div className="search-bar-container">   
          <Search size={20} className="search-icon" />  
          <input
            type="text"
            placeholder="Search items"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"             // 
          />
        </div>

        {/* Category Filters */}
        <div style={{ 
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '8px',
          paddingLeft: '20px',
          paddingRight: '20px'
        }}>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '20px',
                border: '2px solid',
                borderColor: selectedCategory === category.id ? '#EFB509' : 'transparent',
                backgroundColor: selectedCategory === category.id ? '#EFB509' : 'rgba(255, 255, 255, 0.1)',
                color: selectedCategory === category.id ? '#002C54' : '#EFB509',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
            >
              <category.icon size={16} />
              <span style={{ whiteSpace: 'nowrap' }}>{category.label}</span>
            </button>
          ))}
        </div>

       {/* Items Grid */}
<div className="items-grid">
  {filteredItems.map((item) => (
    <div
      key={item.id}
      onClick={() => {
        setEditingItem(item);
        setNewItem({
          title: item.title,
          description: item.description || '',
          category: item.category as 'go' | 'eat' | 'buy' | 'do' | 'other',
          location: item.location || { name: '', address: '' },
          deadline: item.deadline || '',
          createdBy: item.created_by || ''
        });
        setIsEditModalOpen(true);
      }}
      className={`item-card ${item.completed ? 'completed' : ''}`}
    >
      <div className="item-card-header">
        <div className="item-card-category">
          <div className="item-card-category-icon">
            {React.createElement(getCategoryIcon(item.category), { 
              size: 18,
              color: '#CD7213'
            })}
          </div>
          <span className="item-card-category-label">
            {categories.find(cat => cat.id === item.category)?.label}
          </span>
        </div>
        <div 
          className="item-card-checkbox"
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const { error } = await supabase
                .from('taskino_items')
                .update({ completed: !item.completed })
                .eq('id', item.id);
              
              if (error) throw error;
              await fetchItems();
            } catch (error: any) {
              console.error('failed to update completed status:', error);
            }
          }}
        >
          {item.completed && '✓'}
        </div>
      </div>

      <h3 className="item-card-title">
        {item.title}
      </h3>
      
      {item.description && (
        <p className="item-card-description">
          {item.description}
        </p>
      )}

      <div className="item-card-meta">
        {item.location && (
          <div className="meta-info location">
            <MapPin size={14} />
            <span>{item.location.name}</span>
          </div>
        )}
        
        {item.deadline && (
          <div className="meta-info deadline">
            <Calendar size={14} />
            <span>{item.deadline}</span>
          </div>
        )}

        <div className="item-card-footer">
          <span className="footer-created-by">
            {item.created_by} added
          </span>
          <span className="footer-created-at">
            {item.created_at}
          </span>
        </div>
      </div>
    </div>
  ))}
</div>
        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '48px', paddingBottom: '48px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '8px',
              color: 'white'
            }}>
              No items found
            </h3>
            <p style={{
              fontSize: '14px',
              opacity: 0.6,
              fontWeight: '500',
              color: 'white'
            }}>
              Please change the search criteria or add a new item
            </p>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#002C54',
                margin: 0
              }}>Add New Item</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '4px'
                }}
              >×</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#002C54',
                marginBottom: '8px'
              }}>Title *</label>
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                placeholder="Example: New cafe in Shibuya"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#002C54',
                marginBottom: '8px'
              }}>Category *</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '8px'
              }}>
                {categories.slice(1).map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setNewItem({...newItem, category: category.id as any})}
                    style={{
                      padding: '8px 12px',
                      border: '2px solid',
                      borderColor: newItem.category === category.id ? '#EFB509' : '#E5E5E5',
                      backgroundColor: newItem.category === category.id ? '#EFB509' : 'white',
                      color: newItem.category === category.id ? '#002C54' : '#666',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <category.icon size={14} />
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#002C54',
                marginBottom: '8px'
              }}>Description</label>
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                placeholder="Please enter a detailed description"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
  <label style={{
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#002C54',
    marginBottom: '8px'
  }}>Place</label>
<input
  type="text"
  value={newItem.location.name}
  onChange={(e) => setNewItem({
    ...newItem, 
    location: {...newItem.location, name: e.target.value}
  })}
  placeholder="Example: Shibuya Station, Tokyo Tower"
  style={{
    width: '100%',
    padding: '12px',
    border: '2px solid #E5E5E5',
    borderRadius: '8px',
    fontSize: '16px',
    outline: 'none'
  }}
/>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#002C54',
                marginBottom: '8px'
              }}>Date</label>
              <input
                type="date"
                value={newItem.deadline}
                onChange={(e) => setNewItem({...newItem, deadline: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ marginBottom: '32px' }}>
  <label style={{
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#002C54',
    marginBottom: '8px'
  }}>Your name *</label>
  <input
    type="text"
    value={newItem.createdBy}
    onChange={(e) => setNewItem({...newItem, createdBy: e.target.value})}
    placeholder="Your name"
    style={{
      width: '100%',
      padding: '12px',
      border: '2px solid #E5E5E5',
      borderRadius: '8px',
      fontSize: '16px',
      outline: 'none'
    }}
  />
</div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '12px 24px',
                  border: '2px solid #E5E5E5',
                  backgroundColor: 'white',
                  color: '#666',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >Cancel</button>
              <button
                onClick={async () => {
                  console.log('add button clicked', newItem);
                  
                  if (newItem.title.trim() && newItem.createdBy.trim()) {                    try {
                      console.log('Supabase sending...');
                      const insertData = {
                        title: newItem.title,
                        description: newItem.description || null,
                        category: newItem.category,
                        location: newItem.location.name ? {
                          name: newItem.location.name,
                          address: newItem.location.address || ''
                        } : null,
                        deadline: newItem.deadline || null,
                        created_by: newItem.createdBy || 'Anonymous',
                        room_id: currentRoom?.id
                      };
                      
                      console.log('send data:', insertData);
                      
                      const { data, error } = await supabase
                        .from('taskino_items')
                        .insert([insertData])
                        .select();
                
                      console.log('Supabase response:', { data, error });
                      
                      if (error) throw error;
                      
                      await fetchItems();
                      setIsModalOpen(false);
                      setNewItem({
                        title: '',
                        description: '',
                        category: 'go',
                        location: { name: '', address: '' },
                        deadline: '',
                        createdBy: ''
                      });
                    } catch (error: any) {
                      console.error('add error:', error);
                      alert('add failed: ' + error.message);
                    }
                  } else {
                    console.log('title is empty');
                  }
                }}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  backgroundColor: (newItem.title.trim() && newItem.createdBy.trim()) ? '#EFB509' : '#CCC',
                  color: (newItem.title.trim() && newItem.createdBy.trim()) ? '#002C54' : '#666',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (newItem.title.trim() && newItem.createdBy.trim()) ? 'pointer' : 'not-allowed'
                }}
              >Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditModalOpen && editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#002C54',
                margin: 0
              }}>Edit Item</h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingItem(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '4px'
                }}
              >×</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#002C54',
                marginBottom: '8px'
              }}>Title *</label>
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#002C54',
                marginBottom: '8px'
              }}>Category *</label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '8px'
              }}>
                {categories.slice(1).map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setNewItem({...newItem, category: category.id as any})}
                    style={{
                      padding: '8px 12px',
                      border: '2px solid',
                      borderColor: newItem.category === category.id ? '#EFB509' : '#E5E5E5',
                      backgroundColor: newItem.category === category.id ? '#EFB509' : 'white',
                      color: newItem.category === category.id ? '#002C54' : '#666',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <category.icon size={14} />
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#002C54',
                marginBottom: '8px'
              }}>Description</label>
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#002C54',
                marginBottom: '8px'
              }}>Place</label>
              <input
                type="text"
                value={newItem.location.name}
                onChange={(e) => setNewItem({
                  ...newItem, 
                  location: {...newItem.location, name: e.target.value}
                })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#002C54',
                marginBottom: '8px'
              }}>Deadline</label>
              <input
                type="date"
                value={newItem.deadline}
                onChange={(e) => setNewItem({...newItem, deadline: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #E5E5E5',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'space-between'
            }}>
              <button
  onClick={async () => {
    try {
      if (showArchived) {
        // delete
        const { error } = await supabase
          .from('taskino_items')
          .delete()
          .eq('id', editingItem.id);
      } else {
        // archive
        const { error } = await supabase
          .from('taskino_items')
          .update({ archived: true })
          .eq('id', editingItem.id);
      }

      if (error) throw error;
      
      if (showArchived) {
        // update archived display
        const { data, error: fetchError } = await supabase
          .from('taskino_items')
          .select('*')
          .eq('room_id', currentRoom?.id)
          .eq('archived', true)
          .order('created_at', { ascending: false });

        if (!fetchError) {
          const formattedItems = data?.map((item: any) => ({
            ...item,
            created_at: new Date(item.created_at).toISOString().split('T')[0],
            deadline: item.deadline ? new Date(item.deadline).toISOString().split('T')[0] : undefined
          })) || [];
          setItems(formattedItems);
        }
      } else {
        await fetchItems();
      }
      
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error: any) {
      console.error('operation failed:', error);
    }
  }}
  style={{
    padding: '12px 24px',
    border: '2px solid #DC2626',
    backgroundColor: 'white',
    color: '#DC2626',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  }}
>
  {showArchived ? 'Delete' : 'Archive'}
</button>
{showArchived && (
  <button
    onClick={async () => {
      try {
        const { error } = await supabase
          .from('taskino_items')
          .update({ archived: false })
          .eq('id', editingItem.id);

        if (error) throw error;
        
        // update archived display
        const { data, error: fetchError } = await supabase
          .from('taskino_items')
          .select('*')
          .eq('room_id', currentRoom?.id)
          .eq('archived', true)
          .order('created_at', { ascending: false });

        if (!fetchError) {
          const formattedItems = data?.map((item: any) => ({
            ...item,
            created_at: new Date(item.created_at).toISOString().split('T')[0],
            deadline: item.deadline ? new Date(item.deadline).toISOString().split('T')[0] : undefined
          })) || [];
          setItems(formattedItems);
        }
        
        setIsEditModalOpen(false);
        setEditingItem(null);
      } catch (error: any) {
        console.error('restore failed:', error);
      }
    }}
    style={{
      padding: '12px 24px',
      border: '2px solid #10B981',
      backgroundColor: 'white',
      color: '#10B981',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer'
    }}
  >
      Restore
  </button>
)}
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                  }}
                  style={{
                    padding: '12px 24px',
                    border: '2px solid #E5E5E5',
                    backgroundColor: 'white',
                    color: '#666',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >Cancel</button>
                
                <button
                  onClick={async () => {
                    if (newItem.title.trim()) {
                      try {
                        const { error } = await supabase
                          .from('taskino_items')
                          .update({
                            title: newItem.title,
                            description: newItem.description || null,
                            category: newItem.category,
                            location: newItem.location.name ? newItem.location : null,
                            deadline: newItem.deadline || null
                          })
                          .eq('id', editingItem.id);
                  
                        if (error) throw error;
                        
                        await fetchItems();
                        setIsEditModalOpen(false);
                        setEditingItem(null);
                      } catch (error: any) {
                        console.error('update failed:', error);
                      }
                    }
                  }}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    backgroundColor: newItem.title.trim() ? '#EFB509' : '#CCC',
                    color: newItem.title.trim() ? '#002C54' : '#666',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: newItem.title.trim() ? 'pointer' : 'not-allowed'
                  }}
                >Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
{/* QR Code Modal */}
{showQR && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#002C54',
                margin: 0
            }}>Share with QR Code</h2>
              <button
                onClick={() => setShowQR(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '4px'
                }}
              >×</button>
            </div>
            
            <QRCodeComponent shareCode={shareCode} currentRoom={currentRoom} />
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#EFB509',
          border: 'none',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none'
        }}>
        <Plus size={24} color="#002C54" />
      </button>
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

function RoomSelector() {
  const [_rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('room fetch error:', error);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    
    try {
      const shareCode = Math.random().toString(36).substring(2, 15);
      const { error } = await supabase
        .from('rooms')
        .insert([{ name: newRoomName, share_code: shareCode }]);
      
      if (error) throw error;
      navigate(`/room/${shareCode}`);
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
    <div style={{ minHeight: '100vh', backgroundColor: '#16253D', padding: '24px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', color: 'white' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '32px', textAlign: 'center' }}>taskino</h1>
        
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>Create New Room</h2>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Enter room name"
            style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', border: 'none', color: '#002c54' }}
          />
          <button onClick={createRoom} style={{ padding: '12px 24px', backgroundColor: '#EFB509', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Create
          </button>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>Join Room</h2>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter share code"
            style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', border: 'none', color: '#002c54' }}
          />
          <button onClick={joinRoom} style={{ padding: '12px 24px', backgroundColor: '#EFB509', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Join
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;