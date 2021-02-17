var resolved = [false, false]
var tickers_data
var cji_data
var cji_holdings_data
var cji_holding_history_data

function createHoldingHistoryChart(value = false) {
  let data = cji_holding_history_data

  Highcharts.chart('assets-over-time', {
    chart: {
      backgroundColor: "#ef7",
      type: 'area'
    },
    title: { text: undefined },
    xAxis: {
      categories: data.map(day => new Date(day.day).getTime())
    },
    yAxis: {
      labels: {
        format: '{value}%'
      }
    },
    tooltip: {
      pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.percentage:.2f}%</b> (${point.y:,.2f})<br/>',
      split: false
    },
    plotOptions: {
      area: {
        stacking: "percent",
      }
    },
    credits: { enabled: false },
    series: getHoldingHistorySeries(data, value)
  })
}

function getHoldingHistorySeries(data, value) {
  series = []
  if (value) {
    // TODO unimplemented
  } else {
    t0 = performance.now()
    stockList = []

    const createZeroArray = (numZero) => {
      var arr = []
      for (var i = 0; i < numZero; i++) {
        arr[i] = 0
      }
      return arr
    }

    // naively figure out all the stocks we need to chart
    // TODO FIX: performance
    data.map(day => {
      day.holdings.map(holding => {
        if (!stockList.includes(holding.symbol)) {
          stockList.push(holding.symbol)
          series.push({
            name: holding.symbol,
            data: createZeroArray(data.length)
          })
        }
      })
    })

    // generate the series from the data
    // TODO FIX: performance, use a map or something...
    for (var i = 0; i < data.length; i++) {
      holdings = data[i].holdings
      holdings.map(holding => {
        let seriesIndex = series.findIndex((item) => {
          return item.name === holding.symbol
        })

        series[seriesIndex].data[i] = holding.amt_invested
      })
    }


    console.log("took:", performance.now() - t0)

  }

  return series
}

function createTreemap() {
  Highcharts.chart('asset-raw-breakdown-treemap', {
    chart: {
      backgroundColor: "#ef7"
    },
    colorAxis: {
        minColor: '#FFFFFF',
        maxColor: Highcharts.getOptions().colors[0]
    },
    plotOptions: {
      treemap: {
        dataLabels: {
          formatter: function() {
            return "Ticker: " + this.point.name
          } 
        }
      }
    },
    series: [{
        type: 'treemap',
        layoutAlgorithm: 'squarified',
        data: getHoldingData('asset-raw-breakdown'),
    }],
    credits: { enabled: false },
    title: {
        text: undefined
    }
});
         
}

function createPieChart(id) {

  var raw = true
  if (id != "asset-raw-breakdown") {
    raw = false
  }

  titleText = (raw) ? "Distribution of Holdings ($ Invested)" :
                "Distribution of Holdings ($ Value)"
  pointFormat = (raw) ? 
    '{series.name}: <b>{point.percentage:.2f}%</b><br>$ Invested: <b>${point.value:.2f}</b>' :
    '{series.name}: <b>{point.percentage:.2f}%</b><br>$ Value: <b>${point.value:.2f}</b>'

  let chart = Highcharts.chart(id, {
    chart: {
      backgroundColor: "#ef7",
      plotBorderWidth: null,
      plotShadow: false,
      type: "pie"
    },
    title: { text: titleText},
    tooltip: {
      pointFormat: pointFormat
    },
    accessibility: {
      point: {
          valueSuffix: '%'
      }
    },
    plotOptions: {
        pie: {
            allowPointSelect: true,
            cursor: 'pointer',
            dataLabels: {
                enabled: false
            },
            showInLegend: true
        }
    },
    credits: { enabled: false },
    series: [{
      name: "% of Investment",
      colorByPoint: true,
      data: getHoldingData(id)
    }]
  })
}

function getHoldingData(id) {
  var ret = []
  if (id == "asset-raw-breakdown") {
    var total_amt_invested = 0
    cji_holdings_data.map(holding => {
      total_amt_invested += holding.amt_invested
    })

    ret = cji_holdings_data.map(holding => {
      return {
        name: holding.symbol,
        y: (holding.amt_invested / total_amt_invested) * 100,
        value: holding.amt_invested
      }
    })

  } else {
    var total_val = 0
    cji_holdings_data.map(holding => {
      total_val += holding.value
    })

    ret = cji_holdings_data.map(holding => {
      return {
        name: holding.symbol,
        y: (holding.value / total_val) * 100,
        value: holding.value
      }
    })

  }

  return ret.sort((a, b) => (a.y < b.y) ? 1 : -1)
}

function createChart(id, percent = false) {
  let chart = Highcharts.stockChart(id, {
    yAxis: {
      labels: {
        formatter: function () {
          if (percent) {
            return (this.value > 0 ? ' + ' : '') + this.value + '%';
          } else {
            return ("$" + this.value);
          }
        }
      },
      plotLines: [{
        value: 0,
        width: 2,
        color: 'silver'
      }],
    },
    chart: {
      backgroundColor: "#ef7"
    },
    colors: ["#C0F", "#7ef", "#3f0", "#e7f", "#03F", "#F30", "#F60", "#90F"],
    credits: { enabled: false },
    legend: {
      enabled: true,
      verticalAlign: "top",
    },
    plotOptions: getPlotOptions(percent),

    tooltip: {
      pointFormat: getPointFormat(percent),
      valueDecimals: 2,
      split: true
    },
    series: buildSeries(id),

  })
}

function getPointFormat(percent) {
  if (percent) {
    return '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b> ({point.change}%)<br/>'
  } else {
    return '<span style="color:{series.color}">{series.name}</span>: <b>${point.y}</b><br/>'
  }
}

function getPlotOptions(percent) {
  if (percent) {
    return {
      series: {
        compare: 'percent',
        showInNavigator: true,
      }
    }
  }

  return {}
}

function buildSeries(id) {
  if (id == "cj-vs-market") {
    return build_high_series()
  } else if (id == "gain-vs-invested") {
    return get_gvi_series() 
  }

  return []
}

function can_build_chart() {
  return resolved[0] && resolved[1]
}

function get_gvi_series() {
  var series = []
  var value = {
    data: cji_data.map(day => { 
      return [
        new Date(day.time).getTime(),
        day.adj_close,
      ]
    }),
    name: "Investments Value"
  }
  var amt_invested = {
    data: cji_data.map(day => { 
      return [
        new Date(day.time).getTime(),
        day.amt_invested,
      ]
    }),
    name: "Amount Invested"
  }
  series.push(value)
  series.push(amt_invested)
      console.log(amt_invested)
  return series
}

function build_high_ticker_data(data) {
  var index_data = []
  for (const [k, v] of Object.entries(data)) {
    console.log("KEY AND VAL", k, v)
    index_data.push({
      data: build_high_data(v, "value"),
      name: k
    })
  }
  return index_data
}

function build_high_series() {
  var series = []
  series.push({data: build_high_data(cji_data, "index"), name: "CJ"})
  series = series.concat(build_high_ticker_data(tickers_data))
  return series
}

function build_high_data(data, type = "value") {
  return data.map(day => { 
    if (type === "value") {
      return [
        new Date(day.time).getTime(),
        day.adj_close
      ]
    } else {
      return [
        new Date(day.time).getTime(),
        day.index
      ]
    }
  })
}

function build_chart() {
  if (can_build_chart()) {
    //chart.updateSeries(build_series(tickers_data, cji_data))
    createChart("cj-vs-market", true)
  }
}

// TODO make this a lot more generic, is really just requests
// and a boolean to wait. Doesn't need to be in promise.all
// necessarily but could be a nice wrapper.
const tickers_req = fetch("/ticker/^DJI,^IXIC,^GSPC")
const cji_req = fetch("/cji")
const cji_holdings = fetch("/cji/holdings")
const cji_holding_history = fetch("/cji/holdings/history")

Promise.all([tickers_req, cji_req, cji_holdings, cji_holding_history]).then(data => {
  data[0].json().then(d => {
    tickers_data = d
    resolved[0] = true
    build_chart()
  })
  data[1].json().then(d => {
    cji_data = d
    resolved[1] = true
    build_chart()
    createChart("gain-vs-invested")
  })
  data[2].json().then(d => {
    cji_holdings_data = d
    createPieChart("asset-raw-breakdown")
    createPieChart("asset-value-breakdown")
    createTreemap()

    totalVal = 0
    cji_holdings_data.map(holding => totalVal += holding.value)

    document.getElementById("value").textContent = `Value: $${totalVal.toFixed(2)}`
  })
  data[3].json().then(d => {
    cji_holding_history_data = d
    createHoldingHistoryChart()
  })
})
