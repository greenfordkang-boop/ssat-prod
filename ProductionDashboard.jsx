import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area } from 'recharts';

// 생산실 대시보드 메인 컴포넌트
const ProductionDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSubTab, setActiveSubTab] = useState('daily');
  const [rawData, setRawData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    process: 'all',
    equipment: 'all',
    dateFrom: '',
    dateTo: '',
    product: 'all'
  });

  // 세션 스토리지에서 인증 상태 확인
  useEffect(() => {
    const authStatus = sessionStorage.getItem('isProductionAuth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // 로그인 처리
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'PROD2026') {
      setIsAuthenticated(true);
      sessionStorage.setItem('isProductionAuth', 'true');
    } else {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 2000);
    }
  };

  // 로그아웃 처리
  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      setIsAuthenticated(false);
      sessionStorage.removeItem('isProductionAuth');
      setPassword('');
    }
  };

  // CSV 파싱 함수
  const parseCSV = useCallback((text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      if (values.length >= 20) {
        const row = {};
        headers.forEach((header, index) => {
          let value = values[index] || '';
          value = value.replace(/,/g, '').replace(/"/g, '');
          row[header] = value;
        });

        // TOTAL 행 제외
        if (row['품목명'] !== 'TOTAL' && row['생산일자']) {
          data.push({
            date: row['생산일자'] || '',
            process: row['공정'] || '',
            itemCode: row['품목코드'] || '',
            customerPN: row['고객사 P/N'] || '',
            itemName: row['품목명'] || '',
            spec: row['규격'] || '',
            productType: row['품종'] || '',
            equipment: row['설비/LINE'] || '',
            operatingTime: parseFloat(row['가동시간(분)']) || 0,
            cavity: parseFloat(row['Cavity']) || 0,
            shot: parseFloat(row['Shot']) || 0,
            standardQty: parseFloat(row['표준생산량']) || 0,
            productionQty: parseFloat(row['생산수량']) || 0,
            goodQty: parseFloat(row['양품수량']) || 0,
            defectQty: parseFloat(row['불량수량']) || 0,
            disposalQty: parseFloat(row['폐기수량']) || 0,
            yieldRate: parseFloat(row['수율(%)']) || 0,
            defectRate: parseFloat(row['불량율(%)']) || 0,
            disposalRate: parseFloat(row['폐기율(%)']) || 0,
            standardCT: parseFloat(row['표준C/T']) || 0,
            actualCT: parseFloat(row['실제C/T']) || 0,
            performanceRate: parseFloat(row['성능가동율(%)']) || 0,
            workers: parseFloat(row['투입인원']) || 0,
            uph: parseFloat(row['UPH']) || 0,
            upph: parseFloat(row['UPPH']) || 0,
            initialDefect: parseFloat(row['초기불량등']) || 0
          });
        }
      }
    }
    return data;
  }, []);

  // CSV 파일 업로드 처리
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCSV(text);
      setRawData(parsed);
      setIsLoading(false);
    };
    reader.readAsText(file, 'UTF-8');
  }, [parseCSV]);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      if (filters.process !== 'all' && row.process !== filters.process) return false;
      if (filters.equipment !== 'all' && row.equipment !== filters.equipment) return false;
      if (filters.product !== 'all' && row.productType !== filters.product) return false;
      if (filters.dateFrom && row.date < filters.dateFrom) return false;
      if (filters.dateTo && row.date > filters.dateTo) return false;
      return true;
    });
  }, [rawData, filters]);

  // 고유 값 목록
  const uniqueProcesses = useMemo(() => [...new Set(rawData.map(r => r.process).filter(Boolean))], [rawData]);
  const uniqueEquipments = useMemo(() => [...new Set(rawData.map(r => r.equipment).filter(Boolean))], [rawData]);
  const uniqueProducts = useMemo(() => [...new Set(rawData.map(r => r.productType).filter(Boolean))], [rawData]);

  // 요약 통계
  const summaryStats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const totalProduction = filteredData.reduce((sum, r) => sum + r.productionQty, 0);
    const totalGood = filteredData.reduce((sum, r) => sum + r.goodQty, 0);
    const totalDefect = filteredData.reduce((sum, r) => sum + r.defectQty, 0);
    const totalDisposal = filteredData.reduce((sum, r) => sum + r.disposalQty, 0);
    const totalStandard = filteredData.reduce((sum, r) => sum + r.standardQty, 0);
    const avgYield = totalProduction > 0 ? (totalGood / totalProduction * 100) : 0;
    const avgDefectRate = totalProduction > 0 ? (totalDefect / totalProduction * 100) : 0;
    const avgDisposalRate = totalProduction > 0 ? (totalDisposal / totalProduction * 100) : 0;
    const achievementRate = totalStandard > 0 ? (totalProduction / totalStandard * 100) : 0;
    const uniqueItems = new Set(filteredData.map(r => r.itemCode)).size;
    const uniqueDates = new Set(filteredData.map(r => r.date)).size;

    return {
      totalProduction,
      totalGood,
      totalDefect,
      totalDisposal,
      totalStandard,
      avgYield: avgYield.toFixed(1),
      avgDefectRate: avgDefectRate.toFixed(2),
      avgDisposalRate: avgDisposalRate.toFixed(2),
      achievementRate: achievementRate.toFixed(1),
      uniqueItems,
      uniqueDates,
      totalRecords: filteredData.length
    };
  }, [filteredData]);

  // 일별 추이 데이터
  const dailyTrendData = useMemo(() => {
    const grouped = {};
    filteredData.forEach(row => {
      if (!grouped[row.date]) {
        grouped[row.date] = { date: row.date, production: 0, good: 0, defect: 0, standard: 0 };
      }
      grouped[row.date].production += row.productionQty;
      grouped[row.date].good += row.goodQty;
      grouped[row.date].defect += row.defectQty;
      grouped[row.date].standard += row.standardQty;
    });
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      displayDate: d.date.slice(5),
      yieldRate: d.production > 0 ? (d.good / d.production * 100).toFixed(1) : 0
    }));
  }, [filteredData]);

  // 공정별 데이터
  const processData = useMemo(() => {
    const grouped = {};
    filteredData.forEach(row => {
      if (!grouped[row.process]) {
        grouped[row.process] = { process: row.process, production: 0, good: 0, defect: 0, disposal: 0 };
      }
      grouped[row.process].production += row.productionQty;
      grouped[row.process].good += row.goodQty;
      grouped[row.process].defect += row.defectQty;
      grouped[row.process].disposal += row.disposalQty;
    });
    return Object.values(grouped).map(d => ({
      ...d,
      yieldRate: d.production > 0 ? (d.good / d.production * 100).toFixed(1) : 0
    }));
  }, [filteredData]);

  // 설비별 생산량 TOP 10
  const equipmentData = useMemo(() => {
    const grouped = {};
    filteredData.forEach(row => {
      if (!grouped[row.equipment]) {
        grouped[row.equipment] = { equipment: row.equipment, production: 0, good: 0 };
      }
      grouped[row.equipment].production += row.productionQty;
      grouped[row.equipment].good += row.goodQty;
    });
    return Object.values(grouped)
      .sort((a, b) => b.production - a.production)
      .slice(0, 10)
      .map(d => ({
        ...d,
        shortName: d.equipment.length > 15 ? d.equipment.slice(0, 15) + '...' : d.equipment,
        yieldRate: d.production > 0 ? (d.good / d.production * 100).toFixed(1) : 0
      }));
  }, [filteredData]);

  // 품종별 데이터
  const productTypeData = useMemo(() => {
    const grouped = {};
    filteredData.forEach(row => {
      const type = row.productType || '미분류';
      if (!grouped[type]) {
        grouped[type] = { name: type, value: 0 };
      }
      grouped[type].value += row.productionQty;
    });
    return Object.values(grouped).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  // 숫자 포맷팅
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1128] text-white p-6">
        <div className="w-full max-w-md bg-slate-900/50 p-10 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black mb-2 tracking-tight">생산실 통합 관리 시스템</h1>
            <p className="text-slate-500 text-sm font-medium">Production Management System</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-black/40 border ${loginError ? 'border-rose-500 animate-pulse' : 'border-slate-700'} rounded-2xl p-4 text-center text-xl font-bold tracking-widest outline-none focus:ring-2 focus:ring-emerald-500 transition-all`}
            />
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-[0.98]"
            >
              시스템 접속
            </button>
          </form>
          <p className="mt-8 text-center text-slate-600 text-xs">
            © 2026 Production Dashboard. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'overview', label: '종합현황' },
    { id: 'process', label: '공정현황' },
    { id: 'equipment', label: '설비현황' },
    { id: 'quality', label: '품질분석' },
    { id: 'data', label: '데이터조회' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7f9] overflow-x-hidden">
      {/* 네비게이션 바 */}
      <nav className="bg-[#0a1128] text-white px-6 py-2 flex items-center justify-between sticky top-0 z-[100] border-b border-slate-800">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h1 className="text-lg font-black tracking-tight border-r border-slate-700 pr-4 mr-2">MES DASHBOARD</h1>
          </div>
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {rawData.length > 0 && (
            <span className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              데이터 로드됨
            </span>
          )}
          <span className="text-xs text-slate-400 font-medium">ADMIN (Manager)</span>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-rose-500 transition-colors p-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
            </svg>
          </button>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
        {/* CSV 업로드 섹션 */}
        {rawData.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border border-slate-200">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-2xl mb-4">
                <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">생산 데이터 업로드</h2>
              <p className="text-slate-500 mb-6">MES에서 추출한 CSV 파일을 업로드하세요</p>
              <label className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                CSV 파일 선택
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 text-center">
              <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="font-bold text-slate-800">데이터 로딩 중...</p>
            </div>
          </div>
        )}

        {rawData.length > 0 && (
          <>
            {/* 필터 섹션 */}
            <div className="bg-white rounded-2xl shadow-lg p-4 mb-6 border border-slate-200">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold text-slate-600">기간:</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <select
                  value={filters.process}
                  onChange={(e) => setFilters({...filters, process: e.target.value})}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  <option value="all">전체 공정</option>
                  {uniqueProcesses.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={filters.equipment}
                  onChange={(e) => setFilters({...filters, equipment: e.target.value})}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  <option value="all">전체 설비</option>
                  {uniqueEquipments.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select
                  value={filters.product}
                  onChange={(e) => setFilters({...filters, product: e.target.value})}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  <option value="all">전체 품종</option>
                  {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <label className="ml-auto inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold rounded-lg cursor-pointer transition-all text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  CSV 업로드
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* 종합현황 탭 */}
            {activeTab === 'overview' && summaryStats && (
              <div className="space-y-6">
                {/* 핵심 지표 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-500">총 생산수량 (TOTAL)</span>
                      <span className={`text-sm font-bold ${parseFloat(summaryStats.achievementRate) >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {summaryStats.achievementRate}%
                      </span>
                    </div>
                    <div className="text-3xl font-black text-emerald-600 mb-1">
                      {formatNumber(summaryStats.totalProduction)} <span className="text-lg">EA</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      계획: {formatNumber(summaryStats.totalStandard)} EA
                    </div>
                    <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                        style={{width: `${Math.min(parseFloat(summaryStats.achievementRate), 100)}%`}}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <div className="text-sm font-bold text-slate-500 mb-2">평균 수율</div>
                    <div className="text-3xl font-black text-blue-600 mb-1">
                      {summaryStats.avgYield}<span className="text-lg">%</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>양품: {formatNumber(summaryStats.totalGood)}</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <div className="text-sm font-bold text-slate-500 mb-2">불량율 / 폐기율</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-rose-500">{summaryStats.avgDefectRate}%</span>
                      <span className="text-slate-400">/</span>
                      <span className="text-xl font-bold text-amber-500">{summaryStats.avgDisposalRate}%</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                      <span>불량: {formatNumber(summaryStats.totalDefect)}</span>
                      <span>폐기: {formatNumber(summaryStats.totalDisposal)}</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <div className="text-sm font-bold text-slate-500 mb-2">분석 대상</div>
                    <div className="text-2xl font-black text-slate-800 mb-1">
                      {summaryStats.uniqueItems}개 품목
                    </div>
                    <div className="text-xs text-slate-500">
                      {summaryStats.uniqueDates}일간 / {summaryStats.totalRecords}건
                    </div>
                  </div>
                </div>

                {/* 일별 추이 차트 */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                      일별 생산수량 vs 계획수량 추이
                    </h3>
                    <div className="flex gap-2">
                      {['daily', 'yield'].map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveSubTab(tab)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${activeSubTab === tab ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                          {tab === 'daily' ? '생산량' : '수율'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    {activeSubTab === 'daily' ? (
                      <ComposedChart data={dailyTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="displayDate" tick={{fontSize: 11}} />
                        <YAxis tick={{fontSize: 11}} tickFormatter={formatNumber} />
                        <Tooltip
                          formatter={(value, name) => [formatNumber(value), name === 'production' ? '생산량' : name === 'standard' ? '계획량' : name]}
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'}}
                        />
                        <Legend />
                        <Bar dataKey="standard" name="계획량" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="production" name="생산량" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="good" name="양품" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    ) : (
                      <LineChart data={dailyTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="displayDate" tick={{fontSize: 11}} />
                        <YAxis domain={[90, 100]} tick={{fontSize: 11}} />
                        <Tooltip
                          formatter={(value) => [`${value}%`, '수율']}
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'}}
                        />
                        <Line type="monotone" dataKey="yieldRate" name="수율" stroke="#10b981" strokeWidth={3} dot={{fill: '#10b981', r: 4}} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* 공정별 / 품종별 차트 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                      공정별 생산현황
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={processData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tick={{fontSize: 11}} tickFormatter={formatNumber} />
                        <YAxis type="category" dataKey="process" tick={{fontSize: 12, fontWeight: 600}} width={50} />
                        <Tooltip
                          formatter={(value) => formatNumber(value)}
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'}}
                        />
                        <Bar dataKey="production" name="생산량" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="good" name="양품" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                      품종별 생산 비율
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={productTypeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {productTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatNumber(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* 공정현황 탭 */}
            {activeTab === 'process' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {processData.map((p, idx) => (
                    <div key={p.process} className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{background: COLORS[idx % COLORS.length]}}>
                          {p.process[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{p.process}</h4>
                          <p className="text-xs text-slate-500">수율 {p.yieldRate}%</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">생산량</span>
                          <span className="font-bold">{formatNumber(p.production)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">양품</span>
                          <span className="font-bold text-emerald-600">{formatNumber(p.good)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">불량</span>
                          <span className="font-bold text-rose-500">{formatNumber(p.defect)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">폐기</span>
                          <span className="font-bold text-amber-500">{formatNumber(p.disposal)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">공정별 상세 비교</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={processData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="process" tick={{fontSize: 12, fontWeight: 600}} />
                      <YAxis tick={{fontSize: 11}} tickFormatter={formatNumber} />
                      <Tooltip formatter={(value) => formatNumber(value)} contentStyle={{borderRadius: '12px'}} />
                      <Legend />
                      <Bar dataKey="production" name="생산량" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="good" name="양품" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="defect" name="불량" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="disposal" name="폐기" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 설비현황 탭 */}
            {activeTab === 'equipment' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">설비별 생산량 TOP 10</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={equipmentData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{fontSize: 11}} tickFormatter={formatNumber} />
                      <YAxis type="category" dataKey="shortName" tick={{fontSize: 11}} width={120} />
                      <Tooltip
                        formatter={(value, name) => [formatNumber(value), name === 'production' ? '생산량' : '양품']}
                        contentStyle={{borderRadius: '12px'}}
                      />
                      <Legend />
                      <Bar dataKey="production" name="생산량" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="good" name="양품" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 overflow-x-auto">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">설비별 상세 현황</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-bold text-slate-600">설비</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-600">생산량</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-600">양품</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-600">수율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipmentData.map((eq, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium">{eq.equipment}</td>
                          <td className="py-3 px-4 text-right">{formatNumber(eq.production)}</td>
                          <td className="py-3 px-4 text-right text-emerald-600">{formatNumber(eq.good)}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${parseFloat(eq.yieldRate) >= 95 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {eq.yieldRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 품질분석 탭 */}
            {activeTab === 'quality' && summaryStats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg p-6 text-white">
                    <div className="text-sm font-medium opacity-80 mb-1">평균 수율</div>
                    <div className="text-4xl font-black mb-2">{summaryStats.avgYield}%</div>
                    <div className="text-sm opacity-80">양품: {formatNumber(summaryStats.totalGood)} EA</div>
                  </div>
                  <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl shadow-lg p-6 text-white">
                    <div className="text-sm font-medium opacity-80 mb-1">평균 불량율</div>
                    <div className="text-4xl font-black mb-2">{summaryStats.avgDefectRate}%</div>
                    <div className="text-sm opacity-80">불량: {formatNumber(summaryStats.totalDefect)} EA</div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-lg p-6 text-white">
                    <div className="text-sm font-medium opacity-80 mb-1">평균 폐기율</div>
                    <div className="text-4xl font-black mb-2">{summaryStats.avgDisposalRate}%</div>
                    <div className="text-sm opacity-80">폐기: {formatNumber(summaryStats.totalDisposal)} EA</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">공정별 품질 지표</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={processData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="process" tick={{fontSize: 12, fontWeight: 600}} />
                      <YAxis yAxisId="left" tick={{fontSize: 11}} tickFormatter={formatNumber} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{fontSize: 11}} />
                      <Tooltip contentStyle={{borderRadius: '12px'}} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="defect" name="불량수" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="disposal" name="폐기수" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="yieldRate" name="수율(%)" stroke="#10b981" strokeWidth={3} dot={{fill: '#10b981', r: 5}} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 데이터조회 탭 */}
            {activeTab === 'data' && (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800">상세 데이터 ({filteredData.length}건)</h3>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left py-3 px-4 font-bold text-slate-600 whitespace-nowrap">생산일자</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-600 whitespace-nowrap">공정</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-600 whitespace-nowrap">품목코드</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-600 whitespace-nowrap">품목명</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-600 whitespace-nowrap">설비</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-600 whitespace-nowrap">생산수량</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-600 whitespace-nowrap">양품</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-600 whitespace-nowrap">불량</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-600 whitespace-nowrap">수율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-4 whitespace-nowrap">{row.date}</td>
                          <td className="py-2 px-4">
                            <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-medium">{row.process}</span>
                          </td>
                          <td className="py-2 px-4 font-mono text-xs">{row.itemCode}</td>
                          <td className="py-2 px-4 max-w-[200px] truncate" title={row.itemName}>{row.itemName}</td>
                          <td className="py-2 px-4 max-w-[150px] truncate" title={row.equipment}>{row.equipment}</td>
                          <td className="py-2 px-4 text-right font-medium">{row.productionQty.toLocaleString()}</td>
                          <td className="py-2 px-4 text-right text-emerald-600">{row.goodQty.toLocaleString()}</td>
                          <td className="py-2 px-4 text-right text-rose-500">{row.defectQty.toLocaleString()}</td>
                          <td className="py-2 px-4 text-right">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${row.yieldRate >= 95 ? 'bg-emerald-100 text-emerald-700' : row.yieldRate >= 90 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                              {row.yieldRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredData.length > 100 && (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      상위 100건만 표시됩니다. 필터를 적용하여 데이터를 좁혀보세요.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="py-6 px-10 text-center text-slate-400 text-xs font-medium">
        생산관리 시스템 v1.0.0 | 최종 업데이트: {new Date().toLocaleDateString()}
      </footer>
    </div>
  );
};

export default ProductionDashboard;
