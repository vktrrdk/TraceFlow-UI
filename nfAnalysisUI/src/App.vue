<script lang="ts">

import {defineComponent, reactive, toRefs} from "vue";
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap-grid.min.css'
import 'bootstrap/dist/js/bootstrap.min.js'

export default defineComponent({
    name: 'App',
    components: {},
    methods: {
        setup() {
            const state = reactive(
                {
                    token: "",
                    user: {
                        name: "",
                        token: [],}
                }
            )
            return {...toRefs(state)}
        },

        setData() {

        }
    }
});
</script>

<template>
 <div class="app">
     <div class="input-group mb-3">
         <span class="input-group-text" id="basic-addon1">Token:</span>
         <input type="text" class="form-control" placeholder="token" aria-label="Username" aria-describedby="basic-addon1">
         <button @click="setData()" class="btn btn-outline-secondary" type="button">Show</button>
     </div>

     <div class="alert alert-secondary" role="alert">
         <p>Name: {{}}</p>
         <p>Token: {{}}</p>
     </div>
 </div>
</template>

<style scoped>
p {
    color: white;
}
.grey-p{
    color: #b9c8f4;
}
</style>


