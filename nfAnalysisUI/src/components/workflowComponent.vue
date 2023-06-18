<script setup lang="ts">
import {onMounted, reactive, watch} from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import type { RunTrace } from "@/models/RunTrace";
import {useRouter, useRoute} from "vue-router";
import axios from "axios";
import * as d3 from "d3"


const router = useRouter();
const route = useRoute();

const props = defineProps<{
    token: string;
}>();

const workflowState = reactive<{
    loading: boolean;
    token: string;
    run_traces: RunTrace[];
    token_info_requested: boolean
    chart: any;
    error_on_request: boolean;
}>({
    loading: true,
    token: "",
    run_traces: [],
    token_info_requested: false,
    chart: {},
    error_on_request: false,

});

function printTraces() {
    if (workflowState.run_traces?.length > 0) {
        workflowState.run_traces.forEach((token: RunTrace) => {
            console.log(token);
        });
    }
}
function getData(token = props.token) {
    if (token.length > 0) {
        workflowState.loading = true;
        axios.get(`http://localhost:8000/run/${token}/`).then(
            response => {
                if (response.data["error"]) {
                    workflowState.run_traces = []
                    workflowState.error_on_request = true;
                } else {
                    workflowState.run_traces = response.data;
                    workflowState.token_info_requested = true;
                    workflowState.token = token;
                    workflowState.error_on_request = false;
                    printTraces();
                    generateChart();
                }
            },
        );
    }

}

function deleteToken(token: string) {
  // needs implementation
}

function generateChart() {
    let x_data = workflowState.run_traces.map((trace: RunTrace) => Date.parse(trace.timestamp));
    let y_data = workflowState.run_traces.map((trace: RunTrace) => trace.memory);
    let data = workflowState.run_traces.map((trace: RunTrace) => new Object({"date": trace.timestamp, "memory": trace.memory }));
    const width = 800;
    const height = 500;
    /** not working as it should - check alternatives - e.g. https://codesandbox.io/s/d3-bar-chart-vuejs-okz1r?file=/src/components/BarChart.vue
    let svg = d3.select("svg").attr("width", width).attr("height", height);
    const g = svg.append("g");
    const x = d3.scaleTime().domain(x_data);
    const y = d3.scaleLinear().domain(y_data);
    g.append("g").attr("transform", "translate(0" + height + ")").call(d3.axisBottom(x));

    g.append("g").call(d3.axisLeft(y)).append("text")
        .attr("fill", "#000")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "0.71em")
        .attr("text-anchor", "end")
        .attr("Memory (RAM)");

    g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5) **/

}

onMounted(() => {
    getData();
});
</script>

<template>
  <div class="card" v-if="!workflowState.token || workflowState.error_on_request">
      <h5 class="card-header">Enter token</h5>
      <div class="card-body">
          <div class="alert"
              :class="{ 'alert-dark' : !workflowState.error_on_request, 'alert-danger': workflowState.error_on_request}">
              Please enter a valid token to show the corresponding workflow information for this token.
              <strong>The entered token is not valid.</strong>
          </div>
          <div class="input-group mb-3">
              <span class="input-group-text" id="basic-addon1">Token</span>
              <input v-model="workflowState.token" type="text" class="form-control" placeholder="Token" aria-label="token" aria-describedby="basic-addon1">
              <button @click="getData(workflowState.token)" class="btn btn-outline-primary" type="button">Show</button>
          </div>
      </div>
  </div>
  <div class="card" v-if="workflowState.token && workflowState.token_info_requested">
      <h5 class="card-header">Workflow information for token {{workflowState.token}}</h5>
      <div class="card-body" v-if="workflowState.run_traces?.length == 0 && !workflowState.error_on_request">
          <h6 class="card-subtitle mb-2">
              There are no workflows connected to this token. Please use the following instructions to persist workflow metrics to this token.
          </h6>
          <div class="alert alert-dark">
              The following steps need to be taken:
              <ul>
                  <li>Take a look at the current token - the full token is: <strong>{{workflowState.token}}</strong> </li>
                  <li>Start your nextflow workflow as you are used to. Just add the following command line arguments to the execution:
                      <strong>{{`-with-weblog http://localhost:8000/run/${workflowState.token}/`}}</strong></li>
              </ul>
              So your command to execute will look similar to this: <br>
              <span class="text-muted">./nextflow run nextflow-io/elixir-workshop-21 -r master -with-docker -with-weblog http://localhost:8000/run/HWnRyTQfsasfZCr</span>
            <br>
              As soon as the first metrics have been sent to the token-specific-endpoint, you will be able to see the progress here.
          </div>
      </div>
      <div class="card-body" v-if="workflowState.token_info_requested && workflowState.run_traces?.length > 0 && !workflowState.error_on_request">
          <h5 class="card-title">Metrics</h5>
          <svg></svg>
      </div>
      <div class="card-body" v-if="workflowState.token_info_requested && !workflowState.error_on_request">
      <div type="button" class="btn btn-outline-danger" @click="deleteToken(workflowState.token)">
          Delete token
      </div>

  </div>
    <div class="card-body" v-if="workflowState.error_on_request">
        <div class="alert alert-info">
            This token is not correct, please enter another token
        </div>
    </div>
    </div>


</template>

<style scoped>

</style>
