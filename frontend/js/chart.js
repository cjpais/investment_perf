    function btn_press(e) {
      console.log(e)
    }

    var resolved = [false, false]
    var tickers_data
    var cji_data

    var options_amt = {
      chart: { type: 'line'},
      series: [],
      xaxis: { 
        type: 'datetime',
        title: { text: "Date" }
      },
      yaxis: { 
        labels: { formatter: function(val) { return val.toFixed(0) } },
        title: { text: "Value ($)" }
      },
      tooltip: {
        enabled: true,
        shared: true,
        followCursor: true,
        y: {
          formatter: function(val) { return `$${val.toFixed(2)}` }
        }
      },
      chart: {
        animations: {
          enabled: false
        },
      },
      stroke: {
        curve: "smooth"
      },
      colors: [
        "#e7f", 
        "#7ef",
        "#a7f",
        "#f78",
        "#9f1",
      ]
    }

    var options = {
      chart: { type: 'line'},
      series: [],
      xaxis: { 
        type: 'datetime',
        title: { text: "Date" }
      },
      yaxis: { 
        labels: { formatter: function(val) { return `${val.toFixed(0)}%` } },
        title: { text: "% Gain/Loss" }
      },
      tooltip: {
        enabled: true,
        shared: true,
        followCursor: true,
        y: {
          formatter: function(val) { return `${val.toFixed(2)}%` }
        }
      },
      chart: {
        animations: {
          enabled: false
        },
      },
      stroke: {
        curve: "smooth"
      },
      colors: [
        "#e7f", 
        "#7ef",
        "#a7f",
        "#f78",
        "#9f1",
      ]
    }

    var chart1 = new ApexCharts(document.querySelector("#gain-vs-invested"), options_amt);
    chart1.render();
    var chart = new ApexCharts(document.querySelector("#cj-vs-market"), options);
    chart.render();

    function can_build_chart() {
      return resolved[0] && resolved[1]
    }

    function get_gvi_series(cji_data) {
      var series = []
      var amt_invested = {
        data: cji_data.map(day => { 
          return {
            x: new Date(day.time).getTime(),
            y: day.amt_invested,
          }
        }),
        name: "Amount Invested"
      }
      var value = {
        data: cji_data.map(day => { 
          return {
            x: new Date(day.time).getTime(),
            y: day.adj_close,
          }
        }),
        name: "Investments Value"
      }
      series.push(amt_invested)
      series.push(value)
          console.log(amt_invested)
      return series
    }

    function build_gain_vs_invested_chart() {
      chart1.updateSeries(get_gvi_series(cji_data))
    }

    function build_ticker_data(data) {
      var index_data = []
      for (const [k, v] of Object.entries(data)) {
        console.log("KEY AND VAL", k, v)
        index_data.push({
          data: build_data(v),
          name: k
        })
      }
      return index_data
    }

    function build_series(data, cji_data) {
      var series = []
      series = series.concat(build_ticker_data(data))
      series.push({data: build_data(cji_data), name: "CJ"})
      return series
    }

    function build_data(data) {
      return data.map(day => { 
                return {
                  x: new Date(day.time).getTime(),
                  y: (day.index - 100)
                }
              })
    }

    function get_labels(data) {
      return data.map(day => new Date(day.time))
    }

    function build_chart() {
      if (can_build_chart()) {
        chart.updateSeries(build_series(tickers_data, cji_data))
      }
    }

    // TODO make this a lot more generic, is really just requests
    // and a boolean to wait. Doesn't need to be in promise.all
    // necessarily but could be a nice wrapper.
    const tickers_req = fetch("http://localhost:5000/ticker/^DJI,^IXIC,^GSPC")
    const cji_req = fetch("http://localhost:5000/cji")

    Promise.all([tickers_req, cji_req]).then(data => {
      data[0].json().then(d => {
        tickers_data = d
        resolved[0] = true
        build_chart()
      })
      data[1].json().then(d => {
        cji_data = d
        resolved[1] = true
        build_chart()
        build_gain_vs_invested_chart()
      })
    })
