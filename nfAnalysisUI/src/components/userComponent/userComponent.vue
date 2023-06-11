<script lang="ts">
import {defineComponent, reactive, toRefs} from "vue";
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap-grid.min.css'
import 'bootstrap/dist/js/bootstrap.min.js'

export default defineComponent({
    name: 'UserComponent',
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
<div>
    test
</div>
</template>

<style scoped>

</style>
