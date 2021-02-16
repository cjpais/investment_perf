import os
import csv
import json
import math

from datetime import datetime

import pandas
import yfinance as yf
from flask import Flask, request, send_from_directory
app = Flask(__name__)


CJ_INVEST_START_DATE = "2017-07-14"
MONEY_PATH = "{}/money".format(os.getenv("PERSONAL_HOME"))
CODE_PATH = MONEY_PATH + "/investment_perf"
FRONT_END_PATH = CODE_PATH + "/frontend"
BACK_END_PATH = CODE_PATH + "/backend"
DATA_PATH = BACK_END_PATH + "/ticker_data"

market_history = pandas.DataFrame()
ticker_db = {}

class Ticker():

    def __init__(self, symbol):
        self.symbol = symbol
        print("getting short name for", symbol)
        #self.name = yf.Ticker(symbol).info['shortName']
        self.history = market_history[symbol]

        pass
        
    def get_ticker_hist(self, start_date=CJ_INVEST_START_DATE, end_date=datetime.now(), base_index = 100):
        global market_history
        dates = pandas.date_range(start_date, end_date)
        history = []
        
        # TODO another way to do this would be to avoid creating my own class
        # and just add directly to the dataframe and return that in json
        for day in dates:
            # Only add days where the market is open
            day_s = day.strftime("%Y-%m-%d")
            try:
                value = market_history[self.symbol].loc[day, "Adj Close"]

                if math.isnan(value):
                    continue
            except:
                continue

            # If the market is open, then calculate
            percent_gain_loss, index = calc_pgl_and_index(value, history, base_index)

            td = TickerDay(day_s, value, percent_gain_loss, index)
            history.append(td)

        return history

    def to_csv(self):
        self.history.to_csv(DATA_PATH + "/{}.csv".format(self.symbol))

    def toJson(self):
        return json.dumps(self, default=lambda o: o.__dict__)

class Holding():

    def __init__(self, symbol, qty, invested, value):
        self.symbol = symbol
        self.quantity = qty
        self.amt_invested = invested
        self.value = value

class CJIndex():
    
    def __init__(self):
        self.transactions = pandas.read_csv(MONEY_PATH  + "/investment_transactions.csv")
        self.hist, self.holdings = self._get_hist()
        pass

    def get_hist(self):
        return self.hist

    def get_holdings(self):
        return self.holdings

    def _get_hist(self, start_date=CJ_INVEST_START_DATE, end_date=datetime.now(), base_index = 100):
        global market_history
        dates = pandas.date_range(start_date, end_date)
        history = []

        amount_invested = 0
        holdings = {}

        buy_eqiv = ["buy", "reinvest shares", "espp", "restricted stock grant"]

        for day in dates:
            # Only add days where the market is open
            """
            try:
                value = market_history["^DJI"].loc[day, "Adj Close"]
                if math.isnan(value):
                    continue
            except:
                continue
                """

            # Get the dataframe for today
            day_s = day.strftime("%Y-%m-%d")
            tdf = self.transactions[self.transactions["Date"] == day_s]

            if not tdf.empty:
                for k, v in tdf.iterrows():
                    symbol = v["Symbol"]
                    action = v["Action"].lower()
                    quantity = float(v["Quantity"])
                    cost = -float(v["Amount"].replace("$", "").replace(",", ""))

                    if action in buy_eqiv:
                        if symbol in holdings:
                            holdings[symbol].quantity += quantity
                            holdings[symbol].amt_invested += cost
                        else:
                            h = Holding(symbol, quantity, cost, 0)
                            holdings[symbol] = h
                        amount_invested += cost
                    elif action == "sell":
                        if symbol not in holdings:
                            raise Exception("TRYING TO SELL NONEXISTENT HOLDING")

                        # TODO this is wrong, need to have better date in our transactions.
                        # Which shares were sold, and what price they were bought at
                        # instead of averaging over the whole thing
                        pps = holdings[symbol].amt_invested / holdings[symbol].quantity
                        amt_sold = pps * quantity

                        holdings[symbol].quantity -= quantity
                        holdings[symbol].amt_invested -= amt_sold
                        amount_invested -= amt_sold

            # get todays value based on our holdings
            value = 0
            bad_val = False
            for key, holding in holdings.items():
                try:
                    sym_val = market_history[holding.symbol].loc[day, "Adj Close"]
                    if math.isnan(sym_val):
                        bad_val = True
                        break

                    hold_val = sym_val * holding.quantity

                    holdings[holding.symbol].value = hold_val
                    value += hold_val 
                except:
                    bad_val = True
                    break

            if bad_val:
                continue

            perc_gain_loss, _= calc_pgl_and_index(value, history, base_index)
            index = ((value - amount_invested) / amount_invested) * 100 + 100

            td = TickerDay(day_s, value, perc_gain_loss, index, amount_invested)
            history.append(td)
        
        return history, holdings


def build_market_hist():
    ticker_fp = MONEY_PATH + "/investments.txt"
    global market_history
    global ticker_db
    tickers = []

    with open(ticker_fp, 'r') as ticker_file:
        for ticker in ticker_file:
            tickers.append(ticker.strip())

    market_history = yf.download(" ".join(tickers), 
                        period="max", interval="1d", 
                        group_by="ticker", threads=True)

    # write them out to files (why not?!)
    for ticker in tickers:
        t = Ticker(ticker)
        t.to_csv()
        ticker_db[ticker] = t

    return market_history

class TickerDay():

    def __init__(self, time, adj_close, pgl, index, amt_invested = 0):
        self.time = time
        self.adj_close = adj_close
        self.perc_gain_loss = pgl
        self.index = index
        self.amt_invested = amt_invested

    def toJson(self):
        return json.dumps(self, default=lambda o: o.__dict__)


def calc_pgl_and_index(value, history, base_index):
    perc_gain_loss = 0
    index = base_index
    if len(history) != 0:
        yesterday = history[-1]
        pgl_raw = ((value - yesterday.adj_close) / yesterday.adj_close)
        perc_gain_loss = pgl_raw * 100
        index = yesterday.index + (yesterday.index * pgl_raw)

    return perc_gain_loss, index

build_market_hist()
cji = CJIndex()

@app.route('/<path:path>')
def serve_static(path):
    if path == "":
        path = "index.html"
    return send_from_directory(FRONT_END_PATH, path)

"""
@app.route('/css/<path:path>')
def static_css(path):
    return send_from_directory(FRONT_END_PATH + "/css", path)

@app.route('/js/<path:path>')
def static_js(path):
    return send_from_directory(FRONT_END_PATH + "/js", path)
"""

@app.route('/ticker/<symbols_csv>', methods=['GET'])
def ticker(symbols_csv):
    global ticker_db
    symbols = symbols_csv.split(",")

    ticker_data = {}
    for symbol in symbols:
        if symbol.upper() in ticker_db:
            ticker = ticker_db[symbol.upper()]
            ticker_data[symbol.upper()] = ticker.get_ticker_hist()
        else:
            # go find the symbol and add it to the db then return it
            pass

    return json.dumps(ticker_data, default=lambda o: o.__dict__)

@app.route('/cji', methods=['GET'])
def cjindex():
    global cji
    return json.dumps(cji.get_hist(), default=lambda o: o.__dict__)

@app.route('/cji/holdings', methods=['GET'])
def cji_holdings():
    global cji
    return json.dumps(list(cji.get_holdings().values()), default=lambda o: o.__dict__)

app.run(host='0.0.0.0')
