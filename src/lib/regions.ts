import type { Region } from './types'

export const regions: Region[] = [
  { code: 'KR-11', name: '서울', slug: 'seoul', shortName: '서울', mapX: 43, mapY: 22, accent: '#2563eb', tint: '#dbeafe' },
  { code: 'KR-26', name: '부산', slug: 'busan', shortName: '부산', mapX: 73, mapY: 78, accent: '#0891b2', tint: '#cffafe' },
  { code: 'KR-27', name: '대구', slug: 'daegu', shortName: '대구', mapX: 66, mapY: 63, accent: '#65a30d', tint: '#ecfccb' },
  { code: 'KR-28', name: '인천', slug: 'incheon', shortName: '인천', mapX: 34, mapY: 26, accent: '#7c3aed', tint: '#ede9fe' },
  { code: 'KR-29', name: '광주', slug: 'gwangju', shortName: '광주', mapX: 45, mapY: 77, accent: '#d97706', tint: '#fef3c7' },
  { code: 'KR-30', name: '대전', slug: 'daejeon', shortName: '대전', mapX: 51, mapY: 54, accent: '#0f766e', tint: '#ccfbf1' },
  { code: 'KR-31', name: '울산', slug: 'ulsan', shortName: '울산', mapX: 78, mapY: 69, accent: '#059669', tint: '#d1fae5' },
  { code: 'KR-36', name: '세종', slug: 'sejong', shortName: '세종', mapX: 48, mapY: 49, accent: '#c2410c', tint: '#ffedd5' },
  { code: 'KR-41', name: '경기', slug: 'gyeonggi', shortName: '경기', mapX: 43, mapY: 30, accent: '#0284c7', tint: '#e0f2fe' },
  { code: 'KR-42', name: '강원', slug: 'gangwon', shortName: '강원', mapX: 61, mapY: 24, accent: '#16a34a', tint: '#dcfce7' },
  { code: 'KR-43', name: '충북', slug: 'chungbuk', shortName: '충북', mapX: 57, mapY: 44, accent: '#4f46e5', tint: '#e0e7ff' },
  { code: 'KR-44', name: '충남', slug: 'chungnam', shortName: '충남', mapX: 39, mapY: 53, accent: '#e11d48', tint: '#ffe4e6' },
  { code: 'KR-45', name: '전북', slug: 'jeonbuk', shortName: '전북', mapX: 46, mapY: 66, accent: '#ea580c', tint: '#fed7aa' },
  { code: 'KR-46', name: '전남', slug: 'jeonnam', shortName: '전남', mapX: 43, mapY: 86, accent: '#15803d', tint: '#dcfce7' },
  { code: 'KR-47', name: '경북', slug: 'gyeongbuk', shortName: '경북', mapX: 69, mapY: 50, accent: '#be123c', tint: '#ffe4e6' },
  { code: 'KR-48', name: '경남', slug: 'gyeongnam', shortName: '경남', mapX: 63, mapY: 76, accent: '#db2777', tint: '#fce7f3' },
  { code: 'KR-50', name: '제주', slug: 'jeju', shortName: '제주', mapX: 37, mapY: 96, accent: '#525252', tint: '#f5f5f5' },
]

export function findRegionByCode(code: string) {
  return regions.find((region) => region.code === code) ?? regions[0]
}

export function findRegionBySlug(slug: string) {
  return regions.find((region) => region.slug === slug)
}
