(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.DailyMenuData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const portions = (small, large) => [
    { id: 'small', label: '小份', priceCents: small * 100 },
    { id: 'large', label: '大份', priceCents: large * 100 },
  ];
  const single = (price, unit) => [{ id: 'one', label: `每${unit}`, priceCents: price * 100 }];
  return {
    restaurant: '净香园周记把子肉',
    location: '千禧城',
    sourceDate: '2026-06-24',
    categories: [
      { id: 'all', name: '全部菜品', icon: 'grid' },
      { id: 'braised', name: '招牌卤味', icon: 'bowl' },
      { id: 'stir-fry', name: '家常小炒', icon: 'wok' },
      { id: 'vegetable', name: '素菜小碟', icon: 'leaf' },
      { id: 'fish', name: '鲜鱼', icon: 'fish' },
    ],
    items: [
      { id: 'pork', name: '把子肉', category: 'braised', unit: '块', variants: single(10, '块'), featured: true },
      { id: 'dongpo', name: '东坡肉', category: 'braised', unit: '块', variants: single(12, '块') },
      { id: 'meatball', name: '狮子头', category: 'braised', unit: '块', variants: single(8, '块') },
      { id: 'ribs', name: '排骨', category: 'braised', unit: '块', variants: single(15, '块') },
      { id: 'drumstick', name: '鸡腿', category: 'braised', unit: '块', variants: single(5, '块') },
      { id: 'spicy-chicken', name: '辣子鸡', category: 'stir-fry', unit: '份', variants: portions(10, 20) },
      { id: 'pumpkin-chicken', name: '南瓜鸡', category: 'stir-fry', unit: '份', variants: portions(10, 20) },
      { id: 'tripe', name: '牛肚', category: 'stir-fry', unit: '份', variants: portions(10, 20) },
      { id: 'kung-pao', name: '宫保鸡丁', category: 'stir-fry', unit: '份', variants: portions(8, 16) },
      { id: 'cucumber', name: '腌黄瓜', category: 'vegetable', unit: '份', variants: portions(6, 12) },
      { id: 'eggplant-beans', name: '茄子豆角', category: 'vegetable', unit: '份', variants: portions(6, 12) },
      { id: 'steamed-veg', name: '蒸菜', category: 'vegetable', unit: '份', variants: portions(6, 12) },
      { id: 'mixed-veg', name: '素拼', category: 'vegetable', unit: '份', variants: portions(6, 12) },
      { id: 'other-sides', name: '其它小菜', category: 'vegetable', unit: '份', variants: portions(6, 12) },
      { id: 'veg-portion', name: '素菜（份装）', category: 'vegetable', unit: '份', variants: portions(5, 10) },
      { id: 'veg-piece', name: '素菜（单个）', category: 'vegetable', unit: '个', variants: single(2, '个') },
      { id: 'pepper', name: '辣椒', category: 'vegetable', unit: '个', variants: single(3, '个') },
      { id: 'eggplant', name: '茄子', category: 'vegetable', unit: '个', variants: single(3, '个') },
      { id: 'carp', name: '鲤鱼', category: 'fish', unit: '条', variants: single(18, '条') },
      { id: 'perch', name: '鲈鱼', category: 'fish', unit: '条', variants: single(26, '条') },
    ],
  };
});
