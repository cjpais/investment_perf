package main

import (
	"os"
	"strings"
	"log"

	"net/http"
	"io/ioutil"
	"encoding/json"

	"github.com/gin-gonic/gin"
)

var HOME= os.Getenv("PERSONAL_HOME")
var MONEY = HOME + "/money"
var INVESTMENTS = "/investment_perf"

var FEND = MONEY + INVESTMENTS + "/frontend"

var BEND = MONEY + INVESTMENTS + "/backend"
var BEND_API = BEND + "/api"
var CJ_API = BEND_API + "/cj"
var TICKER_API = BEND_API + "/symbols"

func tickerHandler(c *gin.Context) {
	var data map[string]interface{}
	data = make(map[string]interface{})

	tickers := strings.Split(c.Param("symbolsCSV"), ",")
	for _, ticker := range tickers {
		ts := strings.ToUpper(ticker)
		fd, err := ioutil.ReadFile(TICKER_API + "/" + ts + ".json")
		if err != nil {
			log.Fatal(err)
		}
		var result interface{}
		json.Unmarshal(fd, &result)
		data[ts] = result
	}

	c.JSON(http.StatusOK, data)
}

func cjHoldingHistoryHandler(c *gin.Context) {
	c.File(CJ_API + "/holding_history.json")
}

func cjTransactionHandler(c *gin.Context) {
	c.File(CJ_API + "/trans_history.json")
}

func cjHoldingsHandler(c *gin.Context) {
	c.File(CJ_API + "/holdings.json")
}

func cjIndexHandler(c *gin.Context) {
	c.File(CJ_API + "/index_history.json")
}

func main() {
	r := gin.Default()

	r.GET("/ticker/:symbolsCSV", tickerHandler)
	r.GET("/cji/holdings/history", cjHoldingHistoryHandler)
	r.GET("/cji/transactions", cjTransactionHandler)
	r.GET("/cji/holdings", cjHoldingsHandler)
	r.GET("/cji", cjIndexHandler)

	r.GET("/", func(c *gin.Context) { c.File(FEND + "/index.html") })
	r.GET("/index.html", func(c *gin.Context) { c.File(FEND + "/index.html") })
	r.Static("/js", FEND + "/js")
	r.Static("/css", FEND + "/css")

	r.Run(":2000")
}
