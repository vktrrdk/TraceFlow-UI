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
}>({
    loading: true,
    token: "",
    run_traces: [],
    token_info_requested: false,
    chart: {},

});

watch(
    () => props.token, (newToken, oldToken) => {
        if (newToken !== oldToken) {
            updateToken(newToken);
        }
});

function updateToken(token) {
    workflowState.token = token;
    getData();
}

function printTraces() {
    if (workflowState.run_traces?.length > 0) {
        workflowState.run_traces.forEach((token: RunTrace) => {
            console.log(token);
        });
    }
}
function getData() {
    workflowState.loading = true;
    axios.get(`http://localhost:8000/run/information/${props.token}/`).then(
        response => {
            workflowState.run_traces = response.data;
            workflowState.token_info_requested = true;
            workflowState.token = props.token;
            printTraces();
            generateChart();
        },
    );
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
    getData()
});
</script>

<template>
  <div class="card" v-if="props.token">
      <h5 class="card-header">Workflow information for token {{props.token}}</h5>
      <div class="card-body" v-if="workflowState.token_info_requested && workflowState.run_traces?.length == 0">
          <h6 class="card-subtitle mb-2">
              There are no workflows connected to this token. Please use the following instructions to persist workflow metrics to this token.
          </h6>
          <div class="alert alert-info">
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
      <div class="card-body" v-if="workflowState.token_info_requested && workflowState.run_traces?.length > 0">
          <h5 class="card-title">Metrics</h5>
          <svg></svg>
      </div>
  </div>
    <div v-else>
        <div class="alert alert-info">
            Need to implement part for non-existing token / wrong tokens - so user is able to enter a new token.
        </div>
    </div>

</template>

<style scoped>

</style>
