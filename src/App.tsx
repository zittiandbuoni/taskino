import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar, Users, Search, Menu, Plane, UtensilsCrossed, ShoppingBag, Palette, CheckSquare, Share2, Copy } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from './supabase';

declare global {
  interface Window {
    google: any;
  }
}

interface TaskinoItem {
  id: string;
  title: string;
  description?: string;
  category: 'travel' | 'food' | 'shopping' | 'experience' | 'task';
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
  { id: 'all', label: 'すべて', icon: Search, color: '#EFB509' },
  { id: 'travel', label: '旅行・おでかけ', icon: Plane, color: '#EFB509' },
  { id: 'food', label: 'グルメ', icon: UtensilsCrossed, color: '#EFB509' },
  { id: 'shopping', label: '買い物', icon: ShoppingBag, color: '#EFB509' },
  { id: 'experience', label: '体験', icon: Palette, color: '#EFB509' },
  { id: 'task', label: 'タスク', icon: CheckSquare, color: '#EFB509' },
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
    return <div>QRコード生成中...</div>;
  }

  return (
    <div>
      <img src={qrCodeUrl} alt="QR Code" style={{ width: '256px', height: '256px' }} />
      <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
        このQRコードをスマホで読み取って共有
      </p>
      <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
        ルーム: {currentRoom?.name}
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
    category: 'travel' as 'travel' | 'food' | 'shopping' | 'experience' | 'task',
    location: { name: '', address: '' },
    deadline: ''
  });
  
  const [items, setItems] = useState<TaskinoItem[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
  
  const [editingItem, setEditingItem] = useState<TaskinoItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Supabaseからデータを取得
  const fetchItems = async () => {
    if (!currentRoom) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('taskino_items')
        .select('*')
        .eq('room_id', currentRoom.id)
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
    console.error('データの取得に失敗しました:', error);
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
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
    console.error('ルーム取得エラー:', error);
    setError('ルームが見つかりません');
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
// リアルタイム購読の設定
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
        console.log('リアルタイム更新:', payload);
        
        if (payload.eventType === 'INSERT') {
          const newItem = {
            ...payload.new,
            created_at: new Date(payload.new.created_at).toISOString().split('T')[0],
            deadline: payload.new.deadline ? new Date(payload.new.deadline).toISOString().split('T')[0] : undefined
          } as TaskinoItem;
          
          setItems(prevItems => {
            // 重複チェック
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

  // クリーンアップ
  return () => {
    subscription.unsubscribe();
  };
}, [currentRoom]);
// エラー表示
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
        <h2 style={{ color: '#EFB509', marginBottom: '16px' }}>エラー</h2>
        <p>{error}</p>
        <button onClick={() => { setError(null); fetchItems(); }}>再試行</button>
      </div>
    </div>
  );
}

// ローディング表示
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
      <p>読み込み中...</p>
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
    cursor: 'pointer',
    marginRight: '12px'
  }}
>
  ← 戻る
</button>
            <div style={{ 
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'white',
              letterSpacing: '-0.5px'
            }}>taskino</div>
            <div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: '20px',
  fontSize: '14px',
  color: 'rgba(255, 255, 255, 0.8)'
}}>
  <Users size={16} />
  <span>リアルタイム共有中</span>
</div>
<button 
  onClick={() => {
    console.log('QRボタンクリック');
    setShowQR(!showQR);
  }}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginLeft: '8px'
  }}
>
  📱 QR
</button>
<button 
  onClick={() => {
    const shareUrl = `${window.location.origin}/room/${shareCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('共有URLをコピーしました！');
    }).catch(() => {
      prompt('以下のURLをコピーしてください:', shareUrl);
    });
  }}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#EFB509',
    color: '#002C54',
    border: 'none',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }}
>
  <Share2 size={16} />
  共有
</button>
          </div>
          <button style={{
            padding: '8px',
            color: 'rgba(255, 255, 255, 0.8)',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}>
            <Menu size={20} />
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1024px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <Search size={20} style={{ 
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#CD7213'
          }} />
          <input
            type="text"
            placeholder="アイテムを検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '40px',
              paddingRight: '16px',
              paddingTop: '12px',
              paddingBottom: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              fontSize: '16px',
              color: '#002C54',
              outline: 'none'
            }}
          />
        </div>

        {/* Category Filters */}
        <div style={{ 
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '8px'
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
        <div style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          marginBottom: '80px'
        }}>
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
                  deadline: item.deadline || ''
                });
                setIsEditModalOpen(true);
              }}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                opacity: item.completed ? 0.7 : 1,
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
            >
              {/* Header */}
              <div style={{ 
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #FFF3E3, #FFE4B5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {React.createElement(getCategoryIcon(item.category), { 
                      size: 16, 
                      color: '#CD7213'
                    })}
                  </div>
                  <span style={{
                    fontSize: '12px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    backgroundColor: '#EFB509',
                    color: '#002C54',
                    fontWeight: '600'
                  }}>
                    {categories.find(cat => cat.id === item.category)?.label}
                  </span>
                </div>
                <div onClick={async (e) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('taskino_items')
        .update({ completed: !item.completed })
        .eq('id', item.id);
      
      if (error) throw error;
      await fetchItems();
    } catch (error: any) {
      console.error('完了状態の更新に失敗:', error);
    }
  }}
  style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: item.completed ? '#10B981' : '#CD7213',
                  backgroundColor: item.completed ? '#10B981' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'white'
                }}>
                  {item.completed && '✓'}
                </div>
              </div>

              {/* Content */}
              <h3 style={{
                fontWeight: 'bold',
                fontSize: '18px',
                marginBottom: '8px',
                color: '#002C54',
                textDecoration: item.completed ? 'line-through' : 'none'
              }}>
                {item.title}
              </h3>
              
              {item.description && (
                <p style={{
                  fontSize: '14px',
                  marginBottom: '12px',
                  opacity: 0.8,
                  fontWeight: '500',
                  lineHeight: '1.5',
                  color: '#16253D'
                }}>
                  {item.description}
                </p>
              )}

              {/* Meta Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {item.location && (
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#CD7213'
                  }}>
                    <MapPin size={14} />
                    <span>{item.location.name}</span>
                  </div>
                )}
                
                {item.deadline && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#EFB509'
                  }}>
                    <Calendar size={14} />
                    <span>{item.deadline}</span>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(22, 37, 61, 0.1)',
                  marginTop: '8px'
                }}>
                  <span style={{
  fontSize: '12px',
  opacity: 0.6,
  fontWeight: '600',
  color: '#002C54'
}}>
  {item.created_by}が追加
</span>
<span style={{
  fontSize: '12px',
  opacity: 0.4,
  color: '#16253D'
}}>
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
              アイテムが見つかりません
            </h3>
            <p style={{
              fontSize: '14px',
              opacity: 0.6,
              fontWeight: '500',
              color: 'white'
            }}>
              検索条件を変更するか、新しいアイテムを追加してみてください
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
              }}>新しいアイテムを追加</h2>
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
              }}>タイトル *</label>
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                placeholder="例：渋谷の新しいカフェ"
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
              }}>カテゴリ *</label>
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
              }}>説明</label>
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                placeholder="詳細な説明を入力してください"
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
  }}>場所</label>
<input
  type="text"
  value={newItem.location.name}
  onChange={(e) => setNewItem({
    ...newItem, 
    location: {...newItem.location, name: e.target.value}
  })}
  placeholder="例：渋谷駅、東京タワー"
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
              }}>日付</label>
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
              >キャンセル</button>
              <button
                onClick={async () => {
                  console.log('追加ボタンクリック', newItem);
                  
                  if (newItem.title.trim()) {
                    try {
                      console.log('Supabaseに送信中...');
                      const insertData = {
                        title: newItem.title,
                        description: newItem.description || null,
                        category: newItem.category,
                        location: newItem.location.name ? {
                          name: newItem.location.name,
                          address: newItem.location.address || ''
                        } : null,
                        deadline: newItem.deadline || null,
                        created_by: 'あなた',
                        room_id: currentRoom?.id
                      };
                      
                      console.log('送信データ:', insertData);
                      
                      const { data, error } = await supabase
                        .from('taskino_items')
                        .insert([insertData])
                        .select();
                
                      console.log('Supabaseレスポンス:', { data, error });
                      
                      if (error) throw error;
                      
                      await fetchItems();
                      setIsModalOpen(false);
                      setNewItem({
                        title: '',
                        description: '',
                        category: 'travel',
                        location: { name: '', address: '' },
                        deadline: ''
                      });
                    } catch (error: any) {
                      console.error('追加エラー:', error);
                      alert('追加に失敗しました: ' + error.message);
                    }
                  } else {
                    console.log('タイトルが空です');
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
              >追加</button>
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
              }}>アイテムを編集</h2>
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
              }}>タイトル *</label>
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
              }}>カテゴリ *</label>
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
              }}>説明</label>
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
              }}>場所</label>
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
              }}>期限</label>
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
                    const { error } = await supabase
                      .from('taskino_items')
                      .delete()
                      .eq('id', editingItem.id);
                
                    if (error) throw error;
                    
                    await fetchItems();
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                  } catch (error: any) {
                    console.error('削除に失敗:', error);
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
              >削除</button>
              
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
                >キャンセル</button>
                
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
                        console.error('更新に失敗:', error);
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
                >保存</button>
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
              }}>QRコードで共有</h2>
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
  const [rooms, setRooms] = useState<Room[]>([]);
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
      console.error('ルーム取得エラー:', error);
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
      console.error('ルーム作成エラー:', error);
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
          <h2 style={{ marginBottom: '16px' }}>新しいルームを作成</h2>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="ルーム名を入力"
            style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', border: 'none', color: '#002c54' }}
          />
          <button onClick={createRoom} style={{ padding: '12px 24px', backgroundColor: '#EFB509', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            作成
          </button>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ marginBottom: '16px' }}>ルームに参加</h2>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="共有コードを入力"
            style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', border: 'none', color: '#002c54' }}
          />
          <button onClick={joinRoom} style={{ padding: '12px 24px', backgroundColor: '#EFB509', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            参加
          </button>
        </div>

        <div>
          <h2 style={{ marginBottom: '16px' }}>最近のルーム</h2>
          {rooms.map(room => (
            <div
              key={room.id}
              onClick={() => navigate(`/room/${room.share_code}`)}
              style={{
                padding: '16px',
                backgroundColor: 'white',
                marginBottom: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#002C54'
              }}
            >
              {room.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;