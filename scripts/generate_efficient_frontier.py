import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA_PATH = Path(__file__).resolve().parents[1] / "temp.csv"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "web" / "data" / "efficient_frontier.json"

TRADING_DAYS = 252


def load_price_data(path: Path) -> pd.DataFrame:
    """Load the CSV with the three-row header and return close prices."""
    df = pd.read_csv(path, header=[0, 1, 2])
    # Extract the date column from the multi-index header
    date_series = pd.to_datetime(df[("Price", "Ticker", "Date")])

    # The close prices live under the level-0 label "Close"
    closes = df.xs("Close", level=0, axis=1)
    # Flatten to the ticker level
    closes.columns = closes.columns.get_level_values(0)
    closes.index = date_series
    closes.index.name = "Date"
    return closes


def compute_returns(closes: pd.DataFrame) -> pd.DataFrame:
    """Compute daily percentage returns from closing prices."""
    returns = closes.pct_change(fill_method=None).dropna(how="all")
    return returns


def series_to_float_dict(series: pd.Series) -> dict[str, float]:
    """Convert a pandas Series to a JSON-serialisable dict of floats."""
    return {str(idx): float(val) for idx, val in series.items()}


def dataframe_to_float_dict(df: pd.DataFrame) -> dict[str, dict[str, float]]:
    """Convert a DataFrame to a nested dict of floats."""
    return {str(row): {str(col): float(val) for col, val in row_vals.items()} for row, row_vals in df.to_dict().items()}


def generate_weight_grid(num_steps: int = 101) -> np.ndarray:
    """Generate a grid of weights that sum to 1 and are non-negative."""
    weights = []
    grid = np.linspace(0, 1, num_steps)
    for w1 in grid:
        for w2 in grid:
            w3 = 1 - w1 - w2
            if w3 < -1e-9:
                continue
            if w3 < 0:
                w3 = 0.0
            total = w1 + w2 + w3
            if total == 0:
                continue
            vec = np.array([w1, w2, w3]) / total
            weights.append(vec)
    return np.array(weights)


def portfolio_stats(weights: np.ndarray, mean_returns: np.ndarray, cov_matrix: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Calculate annualized returns and volatility for each weight vector."""
    port_returns = weights @ mean_returns * TRADING_DAYS
    port_vols = np.sqrt(np.einsum("ij,jk,ik->i", weights, cov_matrix * TRADING_DAYS, weights))
    return port_returns, port_vols


def build_frontier(vols: np.ndarray, rets: np.ndarray) -> list[int]:
    """Return indices that form the efficient frontier (highest return for a given volatility)."""
    order = np.argsort(vols)
    best = -np.inf
    frontier = []
    for idx in order:
        if rets[idx] >= best - 1e-12:
            frontier.append(idx)
            best = max(best, rets[idx])
    return frontier


def main() -> None:
    closes = load_price_data(DATA_PATH)
    returns = compute_returns(closes)
    mean_returns = returns.mean().to_numpy()
    cov_matrix = returns.cov().to_numpy()

    weights = generate_weight_grid()
    port_returns, port_vols = portfolio_stats(weights, mean_returns, cov_matrix)
    frontier_idx = build_frontier(port_vols, port_returns)

    mean_daily = returns.mean()
    annual_returns = mean_daily * TRADING_DAYS
    annual_volatility = returns.std(ddof=0) * np.sqrt(TRADING_DAYS)

    output = {
        "tickers": closes.columns.tolist(),
        "mean_daily_returns": series_to_float_dict(mean_daily),
        "annualized_returns": series_to_float_dict(annual_returns),
        "annualized_volatility": series_to_float_dict(annual_volatility),
        "covariance": dataframe_to_float_dict(returns.cov()),
        "weights": weights.tolist(),
        "portfolio": {
            "returns": port_returns.tolist(),
            "volatility": port_vols.tolist(),
        },
        "frontier_indices": [int(idx) for idx in frontier_idx],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, indent=2))
    print(f"Saved efficient frontier data to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
