<script setup lang="ts">
import {onMounted, reactive, watch, toRaw} from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import { defineProps } from "vue";
import axios, { all, AxiosResponse} from "axios";
import RadioButton from 'primevue/radiobutton';
import Message from 'primevue/message';

import Button from 'primevue/button';
import ToggleButton from 'primevue/togglebutton';
import MultiSelect from "primevue/multiselect";
import { FilterMatchMode, FilterService } from 'primevue/api'; // should be used?
import InputText from 'primevue/inputtext';
import { Chart, LinearScale, CategoryScale, TimeScale } from 'chart.js/auto'; 

const props = defineProps<{
    runName: string
    tokenId: string
    availableProcesses: string[]
    availableTags: string[];
    runState: string;
}>();


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
const STATUSES = ['SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED', 'ABORTED'];
const NON_AUTO_UPDATE_STATES = ["ABORTED", "COMPLETED", "FAILED"];

const STORAGE_UNITS = ['b', 'kiB', 'MiB', 'GiB'];
const TIME_UNITS = ['s', 'min', 'h'];

const POLLING_INTERVAL: number = 20000;

const metricCharts = reactive<{
  chartsGenerated: boolean;
  chartsInCreation: boolean;
  chartsHaveData: boolean;
  durationFormat: string; // ['s', 'min', 'h']
  memoryFormat: string; 
  memoryChart: any | null;
  memoryCanvas: any | null;
  relativeMemoryChart: any | null;
  relativeMemoryCanvas: any | null;
  ioChart: any | null;
  ioCanvas: any | null;
  cpuChart: any | null;
  cpuCanvas: any | null;
  cpuRamRatioCanvas: any | null;
  cpuRamRatioChart: any | null;
  durationChart: any | null;
  durationCanvas: any | null;
  dynamicChart: any | null;
  dynamicCanvas: any | null;
  selectedMetricProcesses: string[];
  autoselectAllMetricProcesses: boolean;
  autoselectAllMetricTags: boolean;
  selectedTags: string[];
  plotPollingIntervalId: any;
  plotPollingIntervalValue: number;
}>({
  chartsGenerated: false,
  chartsInCreation: false,
  chartsHaveData: false,
  durationFormat: 'h',
  memoryFormat: 'GiB',
  memoryChart: null,
  memoryCanvas: null,
  relativeMemoryChart: null,
  relativeMemoryCanvas: null,
  ioChart: null,
  ioCanvas: null,
  cpuChart: null,
  cpuCanvas: null,
  cpuRamRatioCanvas: null,
  cpuRamRatioChart: null,
  durationChart: null,
  durationCanvas: null,
  dynamicChart: null,
  dynamicCanvas: null,
  selectedMetricProcesses: [],
  autoselectAllMetricProcesses: true,
  autoselectAllMetricTags: true,
  selectedTags: [],
  plotPollingIntervalId: null,
  plotPollintIntervalValue: 0,
});


function getSuffixes(strings: string[]) {
  return strings.map(str => {
    const parts = str.split(':');
    return parts[parts.length - 1];
  });
}

function unfoldTag(tag: any): string {
  if (tag[0] === "" || tag[0] === undefined){
    return ""
  } else if (tag[0] === '_'){
    return tag[1];
  } else {
    return `${tag[0]}: ${tag[1]}`;
  }
}

function createPlotsInitial() {
  if (!(metricCharts.chartsGenerated || metricCharts.chartsInCreation)) {
    createPlots();
    setTimeout(createPlotsInitial, 100);
  }
}


async function updatePlots(): Promise<void> {
  const processNamesToFilterBy: string = JSON.stringify([...new Set(toRaw(metricCharts.selectedMetricProcesses).map((proc: any) => proc['name']))]);
  const tagsToFilterBy: string = JSON.stringify([...new Set(toRaw(metricCharts.selectedTags).map((tag: any) => unfoldTag(tag)))]);
  

  await axios.get(
    `${API_BASE_URL}run/plots/${props.tokenId}`, 
    { params: 
      { processFilter: processNamesToFilterBy, 
        tagFilter: tagsToFilterBy, 
        runName: JSON.stringify(props.runName),
        memoryFormat: metricCharts.memoryFormat,
        durationFormat: metricCharts.durationFormat,
      }
    }
  ).then(
      (response: any) => {
        let relative_ram_data: any = response.data['relative_ram'];
        let cpu_data: any = response.data['cpu'];
        let io_data: any = response.data['io'];
        let ram_data: any = response.data['ram'];
        let duration_data: any = response.data['duration'];
        let cpu_ram_ratio_data: any = response.data['cpu_ram_ratio'];
        
        let relative_datasets: any = { 'label': 'Memory usage in %', 'data': [], 'maxBarThickness': 30 };

        let datasets: any[] = [];
        relative_datasets['data'] = Object.values(relative_ram_data[1]);
        datasets.push(relative_datasets);
        let relative_ram_plot_data: any = [relative_ram_data[0], datasets];

        metricCharts.relativeMemoryChart.data.labels = getSuffixes(relative_ram_plot_data[0]);
        metricCharts.relativeMemoryChart.data.datasets = relative_ram_plot_data[1];
        metricCharts.relativeMemoryChart.update('none');

        datasets = [];
        let cpu_allocation_dataset: any = {'label' : 'CPU allocation in %', 'data': [], 'maxBarThickness': 30}; 
        cpu_allocation_dataset['data'] = Object.values(cpu_data[1][0]);

        datasets.push(cpu_allocation_dataset);
        let cpu_raw_dataset: any = { 'label': 'Raw CPU usage in %', 'data': [], 'maxBarThickness': 30 };
        cpu_raw_dataset['data'] = Object.values(cpu_data[1][1]);
        datasets.push(cpu_raw_dataset);
        let cpu_plot_data: any = [cpu_data[0], datasets]; // can refactor this for all, is not necessary??

        metricCharts.cpuChart.data.labels = getSuffixes(cpu_plot_data[0]);
        metricCharts.cpuChart.data.datasets = cpu_plot_data[1];
        metricCharts.cpuChart.update('none'); 

        let io_read_dataset: any = { 'label': 'Read', 'data': [], 'maxBarThickness': 30};
        let io_write_dataset: any = { 'label': 'Write',  'data': [], 'maxBarThickness': 30};

        datasets = [];
        io_read_dataset['data'] = Object.values(io_data[1][0]);
        io_write_dataset['data'] = Object.values(io_data[1][1]);
        datasets.push(io_read_dataset);
        datasets.push(io_write_dataset);

        let io_plot_data: any = [io_data[0], datasets];
        

        metricCharts.ioChart.data.labels = getSuffixes(io_plot_data[0]);
        metricCharts.ioChart.data.datasets = io_plot_data[1];
        metricCharts.ioChart.options.scales.y.title.text = `I/O values in ${metricCharts.memoryFormat}`;
        metricCharts.ioChart.update('none');

        datasets = [];
        let ram_requested_dataset: any = {'label': 'Requested memory', 'data': [], 'maxBarThickness': 30};
        let ram_vmem_dataset: any = {'label': 'Virtual memory', 'data': [], 'maxBarThickness': 30};
        let ram_rss_dataset: any = {'label': 'Physical memory', 'data': [], 'maxBarThickness': 30};
        
        ram_requested_dataset['data'] = Object.values(ram_data[1][0]);
        ram_vmem_dataset['data'] = Object.values(ram_data[1][1]);
        ram_rss_dataset['data'] = Object.values(ram_data[1][2]);
        datasets.push(ram_requested_dataset)
        datasets.push(ram_vmem_dataset)
        datasets.push(ram_rss_dataset)

        let ram_plot_data: any = [ram_data[0], datasets]

        metricCharts.memoryChart.data.labels = getSuffixes(ram_plot_data[0]);
        metricCharts.memoryChart.data.datasets = ram_plot_data[1];
        metricCharts.memoryChart.options.scales.y.title.text = `Memory values in ${metricCharts.memoryFormat}`;
        metricCharts.memoryChart.update('none')

        datasets = []
        let duration_single_dataset: any = {'type': 'boxplot', 'label': 'Execution in realtime', 'data': [], 'maxBarThickness': 30};
        let duration_sum_dataset: any = {'type': 'bar', 'label': 'Realtime summerized', 'data': [], 'maxBarThickness': 30};
        
        duration_single_dataset['data'] = Object.values(duration_data[1][0]);
        duration_sum_dataset['data'] = Object.values(duration_data[1][1]);
        datasets.push(duration_single_dataset);
        datasets.push(duration_sum_dataset);

        let duration_plot_data: any = [duration_data[0], datasets]
        metricCharts.durationChart.data.labels = getSuffixes(duration_plot_data[0]);
        metricCharts.durationChart.data.datasets = duration_plot_data[1];
        metricCharts.durationChart.options.scales.y.title.text = `Duration values in ${metricCharts.durationFormat}`;
        metricCharts.durationChart.update('none');


        datasets = [];
        
        let cpu_ram_ratio_dataset: any = {'type': 'scatterWithErrorBars', 'label': 'CPU-RAM ratio', 'data': []};

        cpu_ram_ratio_dataset['data'] = Object.values(cpu_ram_ratio_data[1]);
        datasets.push(cpu_ram_ratio_dataset);

        let cpu_ram_ratio_plot_data: any = [cpu_ram_ratio_data[0], datasets]
        metricCharts.cpuRamRatioChart.data.labels = getSuffixes(cpu_ram_ratio_plot_data[0]);
        metricCharts.cpuRamRatioChart.data.datasets = cpu_ram_ratio_plot_data[1];
        metricCharts.cpuRamRatioChart.update('none');

        metricCharts.chartsHaveData = true;

        /** TODO: extend with remaining plots: duration */
      }
    ).catch(error => {
      console.log("This crashed");
      console.log(error);
    });
}


/** Filtering */

/**
 * if (metricCharts.autoselectAllMetricProcesses) {
    selectAllMetricProcesses(); needs to be added
  }

  if (metricCharts.autoselectAllMetricTags) {
    selectAllMetricTags();
  } 


 */

 function metricProcessAutoSelectionChanged(): void {
  if (metricCharts.autoselectAllMetricProcesses && !NON_AUTO_UPDATE_STATES.includes(props.runState)) {
    selectAllMetricProcesses();
  } else {
    // what to do here?
  }
}

function metricTagAutoSelectionChanged(): void {
  if (metricCharts.autoselectAllMetricTags && !NON_AUTO_UPDATE_STATES.includes(props.runState)) {
    selectAllMetricTags();
  }
}

 function metricProcessSelectionChanged(): void {
  if (metricCharts.selectedMetricProcesses.length > 0 && metricCharts.chartsGenerated) {
    updatePlots();
  }
}

function metricTagSelectionChanged(): void {
  if (metricCharts.selectedMetricProcesses.length > 0 && metricCharts.chartsGenerated) {
    updatePlots();
  }
} 


function setSelectedMetricProcesses(processes: any[]): void {
  metricCharts.selectedMetricProcesses = processes;
}

function setSelectedMetricTags(tags: any[]): void {
  metricCharts.selectedTags = tags;
}

function selectAllMetricProcesses(): void {
  setSelectedMetricProcesses(props.availableProcesses);
  //metricProcessSelectionChanged();
}

function unselectAllMetricProcesses(): void {
  setSelectedMetricProcesses([]);
  //metricProcessSelectionChanged();
}

function unselectAllMetricTags(): void {
  setSelectedMetricTags([]);
  //metricTagSelectionChanged();
}

function selectAllMetricTags(): void {
  setSelectedMetricTags(props.availableTags);
  //metricTagSelectionChanged();
}

/** End of filtering */


/** Plot creation **/



async function createRelativeRamPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('relative_ram_canvas');
  metricCharts.relativeMemoryCanvas = canvas;
  const relativeRamChart = new Chart(
    metricCharts.relativeMemoryCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Memory usage in % (physical memory to requested memory)',
            }
          }
        },
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(relativeRamChart);
  metricCharts.relativeMemoryChart = relativeRamChart;


}

async function createIOPlot() {

  const canvas: HTMLCanvasElement = getCanvasDiv('io_canvas')
  metricCharts.ioCanvas = canvas;

  const ioChart = new Chart(
    metricCharts.ioCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'amount of read and written data in GiB',
            }
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(ioChart);
  metricCharts.ioChart = ioChart;

}

async function createDurationPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('duration_canvas');
  metricCharts.durationCanvas = canvas;
  const durationChart = new Chart(
    metricCharts.durationCanvas,
    {
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: `Duration in ${metricCharts.durationFormat}`
            }
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );


  Object.seal(durationChart);
  metricCharts.durationChart = durationChart;
}

async function createRamPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('ram_canvas');
  metricCharts.memoryCanvas = canvas;

  const memoryChart = new Chart(
    metricCharts.memoryCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: `RAM value in ${metricCharts.memoryFormat}`
            },
          },
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(memoryChart);
  metricCharts.memoryChart = memoryChart;


}

async function createCPUPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('cpu_canvas');
  metricCharts.cpuCanvas = canvas;
  const cpuChart = new Chart(
    metricCharts.cpuCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'CPU value in %'
            },
          },
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(cpuChart);
  metricCharts.cpuChart = cpuChart;


}


async function createCPURamRatioPlot() {
  
  const canvas: HTMLCanvasElement = getCanvasDiv('cpu_ram_ratio');
  metricCharts.cpuRamRatioCanvas = canvas;
  const cpuRamRatioChart = new Chart(
    metricCharts.cpuRamRatioCanvas,
    {
      type: 'scatterWithErrorBars',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          annotation: {
            annotations: {
              box_valid: {
                type: 'box',
                xMin: 80,
                xMax: 100,
                yMin: 80,
                yMax: 100,
                backgroundColor: 'rgba(38, 131, 17, 0.22)',
                borderWidth: 0,
              },

            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'CPU allocation in %',
            },
            min: 0,
            ticks: {
              callback: function (value, index, ticks) {
                return value + ' %'
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'RAM usage in % (used related to requested)',
            },
            min: 0,
            ticks: {
              // Include a dollar sign in the ticks
              callback: function (value, index, ticks) {
                return value + ' %'
              }
            }
          }
        },
        
        // These seems to be a bug, the name of the clicked prozess remains "undefined"

        onClick: function (event, datapoints) {
          if (datapoints.length > 0) {
            let element = datapoints[0];
            let index = element.index;
            let clickedProcess: string = metricCharts.cpuRamRatioChart.data.labels[index];
            adjustTextForRatioMessage(clickedProcess, index);
          }
        },
        onHover: function (event, datapoints) {
          if (datapoints.length > 0) {
            event.native.target.style.cursor = 'pointer';
          } else {
            event.native.target.style.cursor = 'default';
          }
        },

      },
      data: {
        labels: [],
        datasets: [],
      }

    }
  )
  Object.seal(cpuRamRatioChart);
  metricCharts.cpuRamRatioChart = cpuRamRatioChart;
  
}

function createPlots() {
  // TODO: check if the plot areas induce erros
  if (canvasesAvailable()) {
    metricCharts.chartsInCreation = true;
    createRamPlot();
    createRelativeRamPlot();
    createCPUPlot();
    createIOPlot();
    createDurationPlot();
    createCPURamRatioPlot();
    metricCharts.chartsGenerated = true;
    metricCharts.chartsInCreation = false;
    startPlotPolling();
  }
 
}

function startPlotPolling(): void {
    plotPollingLoop();
}

function reinitiatePlotPolling(): void {
    if (metricCharts.plotPollingIntervalId) {
        clearInterval(metricCharts.plotPollingIntervalId);
        metricCharts.plotPollingIntervalValue = 0;
    }
    metricCharts.plotPollingIntervalId = setInterval(plotPollingLoop, POLLING_INTERVAL)
    metricCharts.plotPollingIntervalValue = POLLING_INTERVAL
}

function plotPollingLoop(): void {
    updatePlots();
    reinitiatePlotPolling()
}

function canvasesAvailable(): boolean {
  const checkCanvasList: any[] = [
    getCanvasDiv('relative_ram_canvas'), 
    getCanvasDiv('io_canvas'),
    getCanvasDiv('duration_canvas'),
    getCanvasDiv('ram_canvas'),
    getCanvasDiv('cpu_canvas'),
    getCanvasDiv('cpu_ram_ratio')
  ]

  return !checkCanvasList.some(obj => obj === null);
}



function hideAutoUpdateEnableOptionMetric(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(props.runState) && !metricCharts.autoselectAllMetricProcesses;
}



function hideAutoUpdateEnableOptionTags(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(props.runState) && !metricCharts.autoselectAllMetricTags;
}



/* TODO: REFACTOR regarding asynchron
*/
function getCanvasDiv(elementId: string): HTMLCanvasElement {
  const canvasElement = document.getElementById(elementId);
  return canvasElement;

}

/** end of plot creation */


// TODO: needs refactoring
function adjustTextForRatioMessage(clickedProcess: string, idx: number) {

/*let analysisData: any[] = toRaw(workflowState.fullAnalysis["cpu_ram_relation_data"][props.runName]["data"]["data"]);
let elem = analysisData[idx];

let cpu_data: any[] = [elem["xMin"], elem["x"], elem["xMax"]];
let memory_data: any[] = [elem["yMin"], elem["y"], elem["yMax"]];

let concatString = `The process ${clickedProcess} has the following characteristics: \n`
  + `The CPU allocation varies from ${cpu_data[0].toFixed(2)} % to ${cpu_data[2].toFixed(2)} % with an average of ${cpu_data[1].toFixed(2)} %.\n`
  + `The used memory percentage varies from ${memory_data[0].toFixed(2)} % to ${memory_data[2].toFixed(2)}  with an average of ${memory_data[1].toFixed(2)} %.\n`;

analysisInfo.cpuRamRatioText = concatString; */
//analysisInfo.cpuRamRatioText = "The information shown in this label is part of refactoring"

}

onMounted(() => {
    createPlotsInitial();
 // do all the creation stuff
});


</script>

<template>
    <div class="card-body my-4" id="metric_visualization_div">
    <div>
      <h3 class="my-3">Metric Visualizaton</h3>
    
    </div>
    <div class="card-body my-3">
      <div class="row my-3">
        <div class="col-6">
          <MultiSelect v-model="metricCharts.selectedMetricProcesses" :options="availableProcesses"
            v-on:change="metricProcessSelectionChanged();" :showToggleAll=false filter placeholder="Select Processes"
            display="chip" class="md:w-20rem" style="max-width: 40vw" optionLabel="name"
            :disabled="metricCharts.autoselectAllMetricProcesses">
          </MultiSelect>
        </div>
        <div class="col-3">
          <Button :disabled="metricCharts.autoselectAllMetricProcesses" v-on:click="unselectAllMetricProcesses()"
            label="Deselect all" />
          <Button :disabled="metricCharts.autoselectAllMetricProcesses" v-on:click="selectAllMetricProcesses()"
            label="Select all" />
        </div>
        <div class="col-3">
          <ToggleButton id="metricSelectButton" v-model="metricCharts.autoselectAllMetricProcesses"
            onLabel="Autoupdate enabled" offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionMetric()"
            onIcon="pi pi-check" offIcon="pi pi-times" v-on:change="metricProcessAutoSelectionChanged()" />
        </div>
      </div>
      <div class="row my-3">
        <div class="col-6">
          <MultiSelect v-model="metricCharts.selectedTags" :options="availableTags"
            v-on:change="metricTagSelectionChanged();" :showToggleAll=false filter placeholder="Select Tag" display="chip"
            class="md:w-20rem" style="max-width: 40vw" optionLabel="name" :disabled="metricCharts.autoselectAllMetricTags">
            <template #chip="selectedTag">
              <div class="flex align-items-center">
                <div v-if="Object.keys(selectedTag.value)[0] !== ''">{{ Object.keys(selectedTag.value)[0] }} : {{
                  Object.values(selectedTag.value)[0] }}</div>
                <div v-if="Object.keys(selectedTag.value)[0] === ''">Empty tag</div>
              </div>
            </template>
            <template #option="slotProps">
              <div class="flex align-items-center">
                <div v-if="Object.keys(slotProps.option)[0] !== ''">
                  {{ Object.keys(slotProps.option)[0] }}: {{ Object.values(slotProps.option)[0] }}
                </div>
                <div v-if="Object.keys(slotProps.option)[0] === ''">Empty tag</div>
              </div>
            </template>
          </MultiSelect>
        </div>
        <div class="col-3">
          <Button :disabled="metricCharts.autoselectAllMetricTags" v-on:click="unselectAllMetricTags()"
            label="Deselect all" />
          <Button :disabled="metricCharts.autoselectAllMetricTags" v-on:click="selectAllMetricTags()" label="Select all" />
        </div>
        <div class="col-3">
          <ToggleButton id="metricSelectButton" v-model="metricCharts.autoselectAllMetricTags" onLabel="Autoupdate enabled"
            offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionTags()" onIcon="pi pi-check"
            offIcon="pi pi-times" v-on:change="metricTagAutoSelectionChanged()" />
        </div>
      </div>

      <div class="row my-3">
        <div class="col-3">
          <h6 class="p-2">Memory Format</h6>
        </div>
        <div class="col-6 d-flex justify-content-between align-items-center">
            <div class="p-2">
              <RadioButton v-model="metricCharts.memoryFormat" id="mem_format_selection_b" value="b" 
             @change="updatePlots" />
              <label for="mem_format_selection_b" class="mx-1">Bytes</label>
            </div>
            <div class="p-2"> 
              <RadioButton v-model="metricCharts.memoryFormat" id="mem_format_selection_kib" value="kiB"
              @change="updatePlots" />
              <label for="mem_format_selection_kib" class="mx-1">kiB</label>
            </div>
            <div class="p-2"> 
              <RadioButton v-model="metricCharts.memoryFormat" id="mem_format_selection_mib" value="MiB" 
              @change="updatePlots" />
              <label for="mem_format_selection_mib" class="mx-1">MiB</label>
            </div>
            <div class="p-2"> 
              <RadioButton v-model="metricCharts.memoryFormat" id="mem_format_selection_gib" value="GiB" 
              @change="updatePlots" />
              <label for="mem_format_selection_gib" class="mx-1">GiB</label>
            </div>
          </div>
      </div>

      <div class="row my-3">
        <div class="col-3">
          <h6 class="p-2">Duration Format</h6>
        </div>
        <div class="col-4 d-flex justify-content-between align-items-center">
            <div class="p-2">
              <RadioButton v-model="metricCharts.durationFormat" id="duration_format_selection_s" value="s" 
              @change="updatePlots"/>
              <label for="duration_format_selection_s" class="mx-1">s</label>
            </div>
            <div class="p-2"> 
              <RadioButton v-model="metricCharts.durationFormat" id="duration_format_selection_min" value="min"
              @change="updatePlots" />
              <label for="duration_format_selection_min" class="mx-1">min</label>
            </div>
            <div class="p-2">
              <RadioButton v-model="metricCharts.durationFormat" id="mem_format_selection_mib" value="h"
              @change="updatePlots" />
              <label for="duration_format_selection_h" class="mx-1">h</label>
            </div>
          </div>
      </div>


    </div>
    <div v-show="!metricCharts.chartsHaveData">
      <Message severity="info" :closable="false">There is no plot data to show.</Message>
    </div>
    <div class="card-body my-4 py-2" id="canvas_area">
      <div class="plot-section">
        <h5>RAM</h5>
        <canvas id="ram_canvas" class="p-4" ></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.memoryChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>Relative RAM</h5>
        <canvas id="relative_ram_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.relativeMemoryChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>CPU</h5>
        <canvas id="cpu_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.cpuChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>I/O</h5>
        <canvas id="io_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.ioChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>Duration</h5>
        <canvas id="duration_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.durationChart.resetZoom()"/>
      </div>
    </div>
    <hr>
    <div class="card-body my-4 py-2" id="analysis_canvas_area">
      <div class="plot-section">
        <h5>CPU-RAM ratio</h5>
        <Message severity="info" :closable="false" v-if="!metricCharts.chartsHaveData">There is no data to show in this plot.</Message>
        <canvas id="cpu_ram_ratio" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.cpuRamRatioChart.resetZoom()"/>
      </div>

    </div>
    <Message severity="info" :closable="false">
      <!-- {{ analysisInfo.cpuRamRatioText }}--> In refactoring.
    </Message>
  </div>
</template>