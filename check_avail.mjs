import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fhlnvkqgsjpfryxmljhv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobG52a3Fnc2pwZnJ5eG1samh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NzYwODAsImV4cCI6MjA2NDE1MjA4MH0.t6dOZT8wPpsSwNVW8v4s4aL6Ly-N_7z1WOLn-WDXGH8'
);

async function checkData() {
  const { data, error } = await supabase
    .from('availability_data')
    .select('data')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data && data[0] && data[0].data) {
    const availData = data[0].data;
    console.log('총 레코드 수:', availData.length);
    
    // 날짜 필드 확인
    if (availData.length > 0) {
      console.log('\n샘플 데이터 키:', Object.keys(availData[0]).slice(0, 20));
    }
    
    // 월별 데이터 분포 확인
    const monthCount = {};
    availData.forEach(row => {
      const dateStr = String(row.date || row.일자 || row.생산일자 || '');
      let month = 'unknown';
      if (dateStr.includes('-')) {
        month = dateStr.split('-')[1] || 'unknown';
      } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        month = parts[0].length === 4 ? parts[1] : parts[0];
      }
      monthCount[month] = (monthCount[month] || 0) + 1;
    });
    console.log('\n월별 데이터 분포:', monthCount);
    
    // 2월 데이터 샘플
    const febData = availData.filter(row => {
      const dateStr = String(row.date || row.일자 || row.생산일자 || '');
      if (dateStr.includes('-')) {
        return dateStr.split('-')[1] === '02';
      }
      return false;
    });
    console.log('\n2월 데이터 수:', febData.length);
    if (febData.length > 0) {
      console.log('2월 첫번째 샘플:', JSON.stringify(febData[0], null, 2).slice(0, 1500));
    }
    
    // 시간가동율 관련 필드 검색
    if (availData.length > 0) {
      const keys = Object.keys(availData[0]);
      const availKeys = keys.filter(k => 
        k.includes('가동') || k.includes('조업') || k.includes('시간') || k.includes('율')
      );
      console.log('\n가동율 관련 필드:', availKeys);
      
      // 해당 필드 값 샘플 (1월과 2월 비교)
      const janData = availData.filter(row => {
        const dateStr = String(row.date || row.일자 || row.생산일자 || '');
        if (dateStr.includes('-')) {
          return dateStr.split('-')[1] === '01';
        }
        return false;
      });
      
      console.log('\n1월 데이터 수:', janData.length);
      if (janData.length > 0 && availKeys.length > 0) {
        console.log('1월 가동율 관련 값 (첫번째):');
        availKeys.forEach(k => {
          console.log(`  ${k}:`, janData[0][k]);
        });
      }
      
      if (febData.length > 0 && availKeys.length > 0) {
        console.log('\n2월 가동율 관련 값 (첫번째):');
        availKeys.forEach(k => {
          console.log(`  ${k}:`, febData[0][k]);
        });
      }
    }
  }
}

checkData();
