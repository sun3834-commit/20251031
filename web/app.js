const percent = (value, digits = 2) => `${(value * 100).toFixed(digits)}%`;
const buildWeightLabel = (tickers, weight) =>
  tickers
    .map((ticker, idx) => `${ticker} ${percent(weight[idx], 1)}`)
    .join('<br>');

async function loadData() {
  const response = await fetch('data/efficient_frontier.json');
  if (!response.ok) {
    throw new Error('효율적 프론티어 데이터를 불러오지 못했습니다.');
  }
  return response.json();
}

function renderChart(data) {
  const { tickers, weights, portfolio, frontier_indices: frontier } = data;
  const returns = portfolio.returns;
  const volatility = portfolio.volatility;

  const hoverTexts = weights.map((weight, idx) =>
    `연환산 수익률: ${percent(returns[idx])}<br>` +
    `연환산 변동성: ${percent(volatility[idx])}<br><br>` +
    buildWeightLabel(tickers, weight)
  );

  const scatterTrace = {
    x: volatility.map((v) => v * 100),
    y: returns.map((r) => r * 100),
    mode: 'markers',
    type: 'scatter',
    marker: {
      size: 6,
      color: 'rgba(125, 211, 252, 0.55)',
      line: { color: 'rgba(59, 130, 246, 0.6)', width: 1 },
    },
    hovertemplate: '%{text}<extra></extra>',
    text: hoverTexts,
    name: '모든 조합',
  };

  const frontierSorted = [...frontier].sort((a, b) => volatility[a] - volatility[b]);
  const frontierTrace = {
    x: frontierSorted.map((idx) => volatility[idx] * 100),
    y: frontierSorted.map((idx) => returns[idx] * 100),
    mode: 'lines+markers',
    marker: {
      size: 7,
      color: '#4ade80',
      line: { color: '#15803d', width: 1 },
    },
    line: { color: '#4ade80', width: 3 },
    name: '효율적 프론티어',
    text: frontierSorted.map((idx) =>
      `연환산 수익률: ${percent(returns[idx])}<br>` +
      `연환산 변동성: ${percent(volatility[idx])}<br><br>` +
      buildWeightLabel(tickers, weights[idx])
    ),
    hovertemplate: '%{text}<extra></extra>',
  };

  const layout = {
    template: 'plotly_dark',
    margin: { t: 36, r: 24, b: 48, l: 64 },
    xaxis: {
      title: '연환산 변동성 (%)',
      tickformat: '.1f',
      zeroline: false,
      gridcolor: 'rgba(148, 163, 184, 0.15)',
    },
    yaxis: {
      title: '연환산 수익률 (%)',
      tickformat: '.1f',
      zeroline: false,
      gridcolor: 'rgba(148, 163, 184, 0.15)',
    },
    legend: {
      orientation: 'h',
      x: 0,
      y: 1.1,
    },
    paper_bgcolor: 'rgba(15, 23, 42, 0.0)',
    plot_bgcolor: 'rgba(15, 23, 42, 0.0)',
  };

  Plotly.newPlot('frontier-chart', [scatterTrace, frontierTrace], layout, {
    responsive: true,
    displayModeBar: false,
  });
}

function renderAssetSummary(data) {
  const container = document.getElementById('asset-summary');
  container.innerHTML = '';
  data.tickers.forEach((ticker) => {
    const daily = data.mean_daily_returns[ticker];
    const annualReturn = data.annualized_returns[ticker];
    const annualVol = data.annualized_volatility[ticker];

    const card = document.createElement('article');
    card.className = 'asset-card';
    card.innerHTML = `
      <h3>${ticker}</h3>
      <dl>
        <dt>일간 평균 수익률</dt>
        <dd>${percent(daily, 3)}</dd>
        <dt>연환산 기대수익률</dt>
        <dd>${percent(annualReturn)}</dd>
        <dt>연환산 변동성</dt>
        <dd>${percent(annualVol)}</dd>
      </dl>
    `;
    container.appendChild(card);
  });
}

function renderFrontierInsights(data) {
  const { portfolio, weights, tickers, frontier_indices: frontier } = data;
  const returns = portfolio.returns;
  const volatility = portfolio.volatility;

  const minVolIndex = volatility.reduce((bestIdx, vol, idx, arr) =>
    vol < arr[bestIdx] ? idx : bestIdx, 0);

  const maxReturnIndex = frontier.reduce((bestIdx, idx) =>
    returns[idx] > returns[bestIdx] ? idx : bestIdx,
    frontier[0]
  );

  const formatInsight = (title, idx) => `
    <div class="insight-item">
      <dt>${title}</dt>
      <dd>${percent(returns[idx])} · ${percent(volatility[idx])}</dd>
      <p>${buildWeightLabel(tickers, weights[idx])}</p>
    </div>
  `;

  const container = document.getElementById('frontier-insights');
  container.innerHTML = `
    ${formatInsight('최소 변동성 포트폴리오', minVolIndex)}
    ${formatInsight('프론티어 상 최대 수익 포트폴리오', maxReturnIndex)}
  `;
}

(async function init() {
  try {
    const data = await loadData();
    renderChart(data);
    renderAssetSummary(data);
    renderFrontierInsights(data);
  } catch (error) {
    console.error(error);
    const chart = document.getElementById('frontier-chart');
    chart.textContent = '데이터를 불러오는 중 오류가 발생했습니다.';
  }
})();
