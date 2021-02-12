import os
import csv
import json
import math

from datetime import datetime

import pandas
import yfinance as yf
from flask import Flask, request
app = Flask(__name__)


CJ_INVEST_START_DATE = "2017-07-14"
MONEY_PATH = "{}/money".format(os.getenv("PERSONAL_HOME"))
DATA_PATH = MONEY_PATH + "/investment_perf/backend/ticker_data"

market_history = pandas.DataFrame()
ticker_db = {}

class Ticker():

    def __init__(self, symbol):
        self.symbol = symbol
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

class CJIndex():
    
    def __init__(self):
        self.transactions = pandas.read_csv(MONEY_PATH  + "/investment_transactions.csv")
        pass

    def get_hist(self, start_date=CJ_INVEST_START_DATE, end_date=datetime.now(), base_index = 100):
        global market_history
        dates = pandas.date_range(start_date, end_date)
        history = []

        amount_invested = 0
        holdings = {}

        for day in dates:
            # Only add days where the market is open
            try:
                value = market_history["^DJI"].loc[day, "Adj Close"]
                if math.isnan(value):
                    continue
            except:
                continue

            # Get the dataframe for today
            day_s = day.strftime("%Y-%m-%d")
            tdf = self.transactions[self.transactions["Date"] == day_s]

            if not tdf.empty:
                for k, v in tdf.iterrows():
                    symbol = v["Symbol"]
                    action = v["Action"].lower()
                    quantity = float(v["Quantity"])
                    cost = -float(v["Amount"].replace("$", "").replace(",", ""))

                    if action == "buy" or action == "reinvest shares":
                        if symbol in holdings:
                            holdings[symbol] += quantity
                        else:
                            holdings[symbol] = quantity
                        amount_invested += cost
                    elif action == "sell":
                        if symbol not in holdings:
                            raise Exception("TRYING TO SELL NONEXISTENT HOLDING")

                        holdings[symbol] -= quantity
                        amount_invested += cost

            # get todays value based on our holdings
            value = 0
            for symbol, quantity in holdings.items():
                sym_val = market_history[symbol].loc[day, "Adj Close"]
                value += sym_val * quantity

            perc_gain_loss, _= calc_pgl_and_index(value, history, base_index)
            index = ((value - amount_invested) / amount_invested) * 100 + 100

            td = TickerDay(day_s, value, perc_gain_loss, index, amount_invested)
            history.append(td)

        return history


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

@app.route('/ticker/<symbol>', methods=['GET'])
def ticker(symbol):
    global ticker_db
    if symbol.upper() in ticker_db:
        ticker = ticker_db[symbol.upper()]
        return json.dumps(ticker.get_ticker_hist(), default=lambda o: o.__dict__)
    else:
        # go find the symbol and add it to the db then return it
        pass

    return "not in db"

@app.route('/cji', methods=['GET'])
def cjindex():
    global cji
    return json.dumps(cji.get_hist(), default=lambda o: o.__dict__)

app.run(host='0.0.0.0')
