import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    bom_json: {
                        table: 'sys_module'
                        id: 'edaa18303e86469cb634466cf8584b04'
                    }
                    copy_llm_context_ui_action: {
                        table: 'sys_ui_action'
                        id: '11fa68c788594fc89c14a7b43ee54af5'
                    }
                    download_result_report_ui_action: {
                        table: 'sys_ui_action'
                        id: '130e3e4a16d04e74b15b5d5c9b92a577'
                    }
                    download_run_report_ui_action: {
                        table: 'sys_ui_action'
                        id: '92ca8152bdd741ae97667ea424e51e05'
                    }
                    iscan_app_files_scanner_si: {
                        table: 'sys_script_include'
                        id: 'e04e97fa0d984bf9944028c7a3217c73'
                    }
                    iscan_app_menu: {
                        table: 'sys_app_application'
                        id: '1d1db97b9dbd465fa068567531a8d11d'
                    }
                    iscan_app_selector_si: {
                        table: 'sys_script_include'
                        id: '6e9472490d7148ab8ba9433f7dae5c43'
                    }
                    iscan_module_new_custom_only: {
                        table: 'sys_app_module'
                        id: '265444c77d4a4d1f816bf00cc53253a6'
                    }
                    iscan_module_new_full: {
                        table: 'sys_app_module'
                        id: '9bbce2728e97496097a70e1461d2da36'
                    }
                    iscan_module_new_manual: {
                        table: 'sys_app_module'
                        id: 'd0701d2a2bc64c2589f0640959b12099'
                    }
                    iscan_module_results_list: {
                        table: 'sys_app_module'
                        id: '2919566b7aaa48429a0acb4b5d0a5d8e'
                    }
                    iscan_module_runs_list: {
                        table: 'sys_app_module'
                        id: 'a107cf348ced45368391eb2fa077997b'
                    }
                    iscan_module_separator: {
                        table: 'sys_app_module'
                        id: '0dc4a668d1784d70af028ee0f40e87f0'
                    }
                    iscan_report_generator_execute_acl: {
                        table: 'sys_security_acl'
                        id: '168ffcb9e86a4c76941feca59a94727d'
                    }
                    iscan_report_generator_si: {
                        table: 'sys_script_include'
                        id: '4f0f4ce0771345578d66277fcbf4a9f3'
                    }
                    iscan_scan_orchestrator_execute_acl: {
                        table: 'sys_security_acl'
                        id: '8bdae70d789d41aba93c5d0b3d7ed066'
                        deleted: true
                    }
                    iscan_scan_orchestrator_si: {
                        table: 'sys_script_include'
                        id: '0eb63ee5395349689e95dea48bff384a'
                    }
                    iscan_summary_generator_si: {
                        table: 'sys_script_include'
                        id: '5634a3b8450f430a8211e08df30d597f'
                    }
                    iscan_table_scanner_si: {
                        table: 'sys_script_include'
                        id: '7498223fead546c8b07f291e434b87e2'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '05a5a0dd544d4995bb28202d36029ca8'
                    }
                    run_scan_ui_action: {
                        table: 'sys_ui_action'
                        id: 'd0715fc228564a6f9ddcdfe40307d969'
                    }
                    sn_inst_scan_custom_scope_prefix_property: {
                        table: 'sys_properties'
                        id: '0a36c946aa3746d7973e529136b0a514'
                    }
                    sn_inst_scan_genai_enabled_property: {
                        table: 'sys_properties'
                        id: '8c3ea8ec215b4257b2c7ccc60d22eda9'
                    }
                    sn_inst_scan_genai_max_input_chars_property: {
                        table: 'sys_properties'
                        id: '5793a153267145d8b27aa0a618d15442'
                    }
                    sn_inst_scan_include_extended_counts_on_full_scan_property: {
                        table: 'sys_properties'
                        id: 'c03b83b467ad46b8989755cdc71f7556'
                    }
                    sn_inst_scan_result_create_acl: {
                        table: 'sys_security_acl'
                        id: '568b3a3b3efc4c0bbf5df50cbccc0e1d'
                    }
                    sn_inst_scan_result_read_acl: {
                        table: 'sys_security_acl'
                        id: '47b78d79a96947909b8e41c2f4c349f8'
                    }
                    sn_inst_scan_row_count_timeout_property: {
                        table: 'sys_properties'
                        id: '3c2659a2c1bc4ae889e9cf98ab864388'
                    }
                    sn_inst_scan_run_create_acl: {
                        table: 'sys_security_acl'
                        id: '1928fe1021694629a8816518f35ba110'
                    }
                    sn_inst_scan_run_read_acl: {
                        table: 'sys_security_acl'
                        id: '512a847575fe4ddbaf6d1263e7fba3c7'
                    }
                    sn_inst_scan_run_write_acl: {
                        table: 'sys_security_acl'
                        id: 'f83787dffc164299b7cf2da2f0b277bf'
                    }
                    sn_inst_scan_table_create_acl: {
                        table: 'sys_security_acl'
                        id: '8518fabe1dc54c90bcf629ee3592a1d7'
                    }
                    sn_inst_scan_table_read_acl: {
                        table: 'sys_security_acl'
                        id: 'd78b5bc4944748869146a9ccdcf53604'
                    }
                    src_server_IscanAppFilesScanner_server_js: {
                        table: 'sys_module'
                        id: '919236b697f84bd894b506765bfb9bfe'
                    }
                    src_server_IscanAppSelector_server_js: {
                        table: 'sys_module'
                        id: '2548e02141454f26b58fad9a5da1c1d7'
                    }
                    src_server_IscanReportGenerator_server_js: {
                        table: 'sys_module'
                        id: '153044956e4a41da8a714aeac11e785f'
                    }
                    src_server_IscanScanOrchestrator_server_js: {
                        table: 'sys_module'
                        id: 'acbf3796b29e45e2991b344f512b6e75'
                    }
                    src_server_IscanSummaryGenerator_server_js: {
                        table: 'sys_module'
                        id: 'c5bbff7a4ff04cccbf8ab4f0062bdafa'
                    }
                    src_server_IscanTableScanner_server_js: {
                        table: 'sys_module'
                        id: '0fc9527f92814c59ab913beb6c083d09'
                    }
                    src_server_RunScanUiAction_server_js: {
                        table: 'sys_module'
                        id: 'fa5a7d25628743daa7f98903c85df102'
                    }
                }
                composite: [
                    {
                        table: 'sys_db_object'
                        id: '009d8664c2fa4050a6b23b860cc362dd'
                        key: {
                            name: 'x_335329_iscan_crossref'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '0253596aeeb2450093846c840d5e5aa2'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'dictionary_override_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_policy'
                        id: '0279c282b82443b8a2cc34a008eafe0e'
                        key: {
                            table: 'x_335329_iscan_run'
                            short_description: 'Show Target App only for Manual — App scan mode'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '02a31009829d48d59e189b05826438b5'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'row_count'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '036b5f16470ac310654c57f1d16d43d7'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'scan_date'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '051a2315daa2496b910d8a92c3b23a61'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'llm_context'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '0564422f4f3e4fa5a34ffc8cfc054ecf'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'atf_test_count'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '076b5f16470ac310654c57f1d16d43d4'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'acl_count'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '076b5f16470ac310654c57f1d16d43d6'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'integration_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '07edb480a27349bdbbd3529dc6a58be9'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'app_count'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '099be9cef544485ba8126380e44d3da1'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'status'
                            value: 'error'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '09b1cdb5c5794ac2bbb4e2f66794736f'
                        key: {
                            sys_security_acl: '47b78d79a96947909b8e41c2f4c349f8'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '09ba0dca86034bd4a73efbd10eb5e81f'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'table_name'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '09c143433b164c07bbcfa1f7cae58e32'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'status'
                            value: 'complete'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '0a48ce3bf21d4c7d88036cddaf83aac9'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scan_date'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '0acc2fcb65c24ae09654104e4b875030'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '0b6b5f16470ac310654c57f1d16d43d5'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'business_rule_count'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '0ce84091c11a4aafb59ceebf9caee06e'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'referencing_app'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '0e7fd8cbce8644ab8e9858219bde91f2'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'table_name'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '0f6b5f16470ac310654c57f1d16d43d7'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'script_include_count'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '1100b726cd2445649015a8143ce12a60'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scripted_rest_api_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '11b7d45c68044c719630b4ea76bef65c'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'referencing_field'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '13c497704b6b4ae39c72ff4398f00ac2'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'processor_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '16d389f6d3f14baaad0dad565f5404fd'
                        key: {
                            sys_security_acl: '8518fabe1dc54c90bcf629ee3592a1d7'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_ui_action_role'
                        id: '16d5a8d2722242c484094a7c2bb5a02d'
                        key: {
                            sys_ui_action: '130e3e4a16d04e74b15b5d5c9b92a577'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '18f097855a1a48a482573915f9202a46'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'scan_mode'
                            value: 'single_table'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '19464471fbd74916a0b782a93bd2fdb0'
                        key: {
                            sys_security_acl: 'f83787dffc164299b7cf2da2f0b277bf'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: '1a52cdd8bd0f46a297532686535f5ff0'
                        key: {
                            name: 'x_335329_iscan_run'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '1aafd33521b04ad9ba000361c9c9de33'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'service_portal_widget_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '1c897be5bb0b490e8caf5af73359a141'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'ui_action_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '1c946617b1c14ca4923a6e8f044777da'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'integration_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '1eea5c69d8f3480da7fe22c6d961a658'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'transform_map_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '1f782346b3bc41c4a8451c2ee04d509f'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'llm_context'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '2129aab706c747d7808eeace07d4a568'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'table_list'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '2262e3da474ac310654c57f1d16d4382'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: '.end_split'
                            position: '9'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2467cf9f800e4138b6338c63247bfb01'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '25350e0e47c60310654c57f1d16d432a'
                        key: {
                            list_id: {
                                id: '61350e0e47c60310654c57f1d16d4326'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'scan_mode'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '25f4d9e998d74e50bbab836b462d5910'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'scan_mode'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '261d0793254f4bad83970741d43763b5'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scan_mode_used'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '26249003b9c04f9a91b3577c886acc66'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'subflow_count'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '2662e3da474ac310654c57f1d16d437f'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'sys_created_on'
                            position: '5'
                        }
                    },
                    {
                        table: 'sys_ui_action_role'
                        id: '266f6eb002b5467ab6f3b35f852aaff8'
                        key: {
                            sys_ui_action: 'd0715fc228564a6f9ddcdfe40307d969'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_user_role_contains'
                        id: '27d6af56478ac310654c57f1d16d43f9'
                        deleted: true
                        key: {
                            role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                            contains: {
                                id: '2831a114c611228501d4ea6c309d626d'
                                key: {
                                    name: 'admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '2a62e3da474ac310654c57f1d16d437c'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'status'
                            position: '1'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '2b354282470a0310654c57f1d16d4315'
                        deleted: true
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: '.end_split'
                            position: '8'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '2bc420a8fea6482fa2eb823322b0ecef'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'fix_script_count'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '2c585be46311492eb03cae3a665bbd08'
                        key: {
                            sys_security_acl: '168ffcb9e86a4c76941feca59a94727d'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '2e91f375d87a45738ff632b875589a11'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'table'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2ece99ed54f448f9ad1c579d274bf1cd'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'well_known_base'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '2f0b6252e32e47eca8823f9773e08035'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'acl_count'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2f305a85f9ff49ab8d9fd4b8dc3ae1e9'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'notification_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '2f354282470a0310654c57f1d16d4312'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: '.split'
                            position: '4'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '30a576b889ab4f2884e84cfb1b38ec1b'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'extends_table'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '30fb72d95fbb401499a7b35d75505263'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'run'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '32bbeeffdd654e328031dda6f9f6c882'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'service_portal_widget_count'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '352a5432585c4b0a883cb0f88350a2c8'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'status'
                            value: 'running'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '35c2061320e4462d99d72f0c078eb212'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'well_known_base'
                            value: 'none'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: '37b86b7ae9314808868b329894b0dd19'
                        key: {
                            logical_table_name: 'x_335329_iscan_result'
                            col_name_string: 'run'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '3907630db09e42738d50e772d64ade8e'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'app_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3967d319522a4017a7d162dde8149574'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'comments'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '39ff3e3cbcad4ae0a18fa72a9df4c936'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'inbound_reference_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '3dd367cd172e47989982e965b170d060'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'app'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '3e0c33e3c821466bbee517a0bf2eb787'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'result'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '3eea98ba78634989850ceda6ba5701ab'
                        key: {
                            sys_security_acl: '512a847575fe4ddbaf6d1263e7fba3c7'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '4029a6f708fa4759add6b9f71b35f91a'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'dictionary_override_list'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '40858810f85a4a9eae0adafcac233a89'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'status'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '420ccfdf62e64947b22f820023b41f66'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'comments'
                            language: 'en'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '42207c1ac93d4b8496b889822f14b9f7'
                        key: {
                            name: 'x_335329_iscan_crossref'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '444f6f22b16d4a768024853b2ad8debe'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'activities'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '44e7e6a766ab467a83317d4c7f19cdcc'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'summary_text'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '45c2b30e19c14f57b4d105164205ae35'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '47def4e46a8a47fe97fb775affbd4956'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'referencing_table'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '496a92ec3a9247a78a376ac2f721b977'
                        deleted: true
                        key: {
                            sys_security_acl: '8bdae70d789d41aba93c5d0b3d7ed066'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_ui_policy'
                        id: '4ad8abc64a25497194b2b3a0b51a7683'
                        key: {
                            table: 'x_335329_iscan_run'
                            short_description: 'Show Target Table only for Manual — Single Table scan mode'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '4b883125e5b24121829276d10fc50c79'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'well_known_base'
                            value: 'cmdb_ci'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '4b9748e6d1534ea294ace229eb2014d0'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'flow_count'
                        }
                    },
                    {
                        table: 'sys_ui_action_role'
                        id: '4bde3ec7ed204c039188ef84dab7854f'
                        key: {
                            sys_ui_action: '92ca8152bdd741ae97667ea424e51e05'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '4ce7189584694097b8bd8aa77f7df2ba'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'status'
                            value: 'pending'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '4de923694fd046b9bb78f6ca25df1708'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'referencing_field'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '4f0669cffd344e109f8ace7314dd47c4'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'ui_policy_count'
                        }
                    },
                    {
                        table: 'sys_ui_list'
                        id: '4f6b5f16470ac310654c57f1d16d43d2'
                        key: {
                            name: 'x_335329_iscan_result'
                            view: {
                                id: 'Default view'
                                key: {
                                    name: 'NULL'
                                }
                            }
                            sys_domain: 'global'
                            element: 'NULL'
                            relationship: 'NULL'
                            parent: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5082d699c70b47c4b9bc6966372bc2bb'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'reference_field_list'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '514e255a266447dd82566b83d42e88a0'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'manual_app_list'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: '543afa47ac89411f80bc373cd5d2ccfa'
                        key: {
                            logical_table_name: 'x_335329_iscan_crossref'
                            col_name_string: 'table'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '548b9deef6ad4a87a5d0fcc54fab9bda'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'atf_test_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '5559854333194b30ab8310b69eae58ec'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'well_known_base'
                            value: 'other'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '5568a86de4af49e08ddce5d6ea7d8297'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'inbound_email_action_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5588efc3078146a88fbc292dc8445f4a'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'app'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '596423871af64af5acf4fd707abc461c'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'completed'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5bc04a9218eb4fe5b37a9714fc8c75b9'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'referencing_scope'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5bc199fa024e464f888cae0fca307342'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'well_known_base'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5d65576e9a87424eaf5bd50796b19647'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'dictionary_override_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '60c9acb3f2f84bc7be9df4f70b3f8192'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scripted_rest_api_count'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '60db151b46e64480b787d6a8786543fe'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'scan_mode'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '6127304065424326b485ff2ac520bb88'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'workflow_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_list'
                        id: '61350e0e47c60310654c57f1d16d4326'
                        key: {
                            name: 'x_335329_iscan_run'
                            view: {
                                id: 'Default view'
                                key: {
                                    name: 'NULL'
                                }
                            }
                            sys_domain: 'global'
                            element: 'NULL'
                            relationship: 'NULL'
                            parent: 'NULL'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '61350e0e47c60310654c57f1d16d432a'
                        key: {
                            list_id: {
                                id: '61350e0e47c60310654c57f1d16d4326'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'requested_by'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '61ef79fbfc0c4df5a9d77895dfa02df0'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'table_list'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '6262e3da474ac310654c57f1d16d4384'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'activity.xml'
                            position: '12'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '63354282470a0310654c57f1d16d4312'
                        deleted: true
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'requested_by'
                            position: '3'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6458eb81deea40a3af2d6c200fd1642a'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'dashboard_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '65b2ef1da5e94787933f32b9c0b3f95b'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'inbound_email_action_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6601e63b40c6429692d80cd403b2c898'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scheduled_job_count'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '6662e3da474ac310654c57f1d16d4381'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'app_count'
                            position: '8'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '678be80ebe1440c4b536cb44aa8f16a9'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'row_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '68a9ddb2dc3e47fdb6b4d0aef59af6c6'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'field_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '69542948e6ad41c7859db69f5e7e2069'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'fix_script_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '69fef79877ca4055ab4ad5784b3097b5'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'catalog_item_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '6b2d5acbc2ae4e48b725dde01a3ac680'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'integration_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_section'
                        id: '6b354282470a0310654c57f1d16d4303'
                        key: {
                            name: 'x_335329_iscan_run'
                            caption: 'NULL'
                            view: {
                                id: 'Default view'
                                key: {
                                    name: 'NULL'
                                }
                            }
                            sys_domain: 'global'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '6b40ada5d8ec4156b18867e949e54426'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'requested_by'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6d4f228003f04de29a59fe48989608f1'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'client_script_count'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '6e62e3da474ac310654c57f1d16d437b'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'scan_mode'
                            position: '0'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6e895f5ea3fe4b92a16697c39cc02d3e'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'script_include_count'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: '6f354282470a0310654c57f1d16d4314'
                        deleted: true
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'app_count'
                            position: '7'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '6f4b92437ce748409c3c8f49a179e4c6'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'status'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6ff749ede1e743eb8c93529dad972526'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7276823e9b914a3287b72ce50f39a432'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'manual_app_list'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7407db42381d4a43b939d13430da0c6d'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'report_count'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '743ea636ea9149e7a3ed211bac51c6e2'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'acl_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '753e0d83d81e476b8fa0c94dc665afbd'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scan_mode_used'
                            value: 'full_access'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7752ece0face44f1a685a58b6902fa87'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '77ffeec0deb343688466e0c7e67fd2fa'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'table_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7b003547173a4bd5b13c7e7536a19708'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'summary_text'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7b080f4cdec04923a51ec91b4038e715'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'referencing_app'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '7c13e97ab7874b098ca6e5a1619fa49c'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'completed'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '7c585012fe15459c86779b080467d889'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'script_include_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '7df10da50eea42aea4c0ac2c41763693'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'dictionary_override_list'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '7e8ad8f57a63472ea0581ebd724d9041'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '7f50b7c0da6042b5866a0491a434cb8d'
                        key: {
                            name: 'x_335329_iscan_run'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '81577938758f4deab8e5b3d303a5f8d9'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'subflow_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '833a79cb4d2346d3bc50cd8ce732f8fa'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'service_portal_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '836b5f16470ac310654c57f1d16d43d5'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'app'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '836b5f16470ac310654c57f1d16d43d8'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'summary_text'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8426cbdcda3d44d4b5b5fc46d3234c7e'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'field_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '84ead4445d274ae2a75625f6174044a7'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'started'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '86524ab91d1b4a8ab696cafd583ac593'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'table'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '876b5f16470ac310654c57f1d16d43d7'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'scan_mode_used'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '88c5164cf7764f40811e512629c6f7dd'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'inbound_reference_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '895c4a514c564d9292966d9be1395407'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'inbound_reference_list'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '8a8e7297716e4f14a5db005c795de64e'
                        key: {
                            name: 'x_335329_iscan_result'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '8b6b5f16470ac310654c57f1d16d43d6'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'run'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: '8f6b5f16470ac310654c57f1d16d43d5'
                        key: {
                            list_id: {
                                id: '4f6b5f16470ac310654c57f1d16d43d2'
                                key: {
                                    name: 'x_335329_iscan_result'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'flow_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9266b92f35254cb7b911d75d72f6f73d'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'flow_action_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '95ab80bb2e4543cdb912797f3c6bb704'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'result'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '9794aa90fccf4807983332f4fe21535f'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'target_app'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9b1dea93f2824efa9e0977ce66b55d29'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'requested_by'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '9ba850c46fc64cb2a3faaf90362e42b2'
                        key: {
                            sys_security_acl: 'd78b5bc4944748869146a9ccdcf53604'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9e0a0e5465164016b75550659ea8a5e1'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'data_policy_count'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '9eea79f65281412c80a472b194e95baf'
                        key: {
                            name: 'x_335329_iscan_table'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '9f22ed1c218d4de7a7e2b6ac4b8a6fca'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'notification_count'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'a10c13d27cba447fbdf1b051e3df7eec'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'referencing_table'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'a3354282470a0310654c57f1d16d4314'
                        deleted: true
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'status'
                            position: '6'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'a662e3da474ac310654c57f1d16d4383'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'activities'
                            position: '11'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'a7354282470a0310654c57f1d16d4311'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'started'
                            position: '2'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: 'a9350e0e47c60310654c57f1d16d432a'
                        key: {
                            list_id: {
                                id: '61350e0e47c60310654c57f1d16d4326'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'status'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'a9f85d77e5384783b874c3f87f49f0aa'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'activities'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'aa62e3da474ac310654c57f1d16d4380'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'requested_by'
                            position: '7'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: 'ab4799b8336944dc9dbb7510ed758fc5'
                        key: {
                            logical_table_name: 'x_335329_iscan_run'
                            col_name_string: 'requested_by'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ac80c2a9e6a048248722bd23e5c3fb3a'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'service_portal_count'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: 'ad350e0e47c60310654c57f1d16d4328'
                        key: {
                            list_id: {
                                id: '61350e0e47c60310654c57f1d16d4326'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'app_count'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: 'ad350e0e47c60310654c57f1d16d4329'
                        key: {
                            list_id: {
                                id: '61350e0e47c60310654c57f1d16d4326'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'manual_app_list'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'ae3f383c1fd44a04a2290b9d94b63ab5'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'flow_action_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'ae518412251e4170accfc532d4c6612a'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'inbound_reference_list'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'ae62e3da474ac310654c57f1d16d437d'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'completed'
                            position: '3'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'aeb4e83ad0ad48fb8bbb365f742e555d'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scan_mode_used'
                            value: 'app_files_fallback'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'af354282470a0310654c57f1d16d430e'
                        deleted: true
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: '.begin_split'
                            position: '0'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'b0a9ed7e8c054493b7a209a2c6afbf35'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'ui_action_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b5a0ea8a879845878ed879cf4bf62423'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scan_date'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'b625169f185744d48e0064ba6c75379d'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'choice_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'b695504e28d14b269593ceaf37b42446'
                        key: {
                            sys_security_acl: '568b3a3b3efc4c0bbf5df50cbccc0e1d'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'b6b553848de543a6911873df124a5a31'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'report_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: 'b7813fcf1acf4d40aee57e4498afe88e'
                        key: {
                            name: 'x_335329_iscan_result'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'b9cd639fd3dd4a3aa736bc7c03e8fc3e'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'target_table'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_ui_action_role'
                        id: 'bb453dbf8b4648149145ff0c4ab114b3'
                        key: {
                            sys_ui_action: '11fa68c788594fc89c14a7b43ee54af5'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'bd13221699524cfcb1763a3350a95ced'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'ui_policy_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'bd8691268b45488bb4aceb559decfaf1'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'business_rule_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'bdea67431bb3421a869a1e562335ca69'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'target_table'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'c62b4eab56d4443a9d96edd2d51dd748'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scheduled_job_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'ca08c13d465543b1884ba28601ea47d8'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'scan_mode'
                            value: 'full'
                        }
                    },
                    {
                        table: 'sys_ui_policy_action'
                        id: 'ca52d61078fc4958b3dfb4b4907b0f31'
                        key: {
                            ui_policy: {
                                id: '0279c282b82443b8a2cc34a008eafe0e'
                                key: {
                                    table: 'x_335329_iscan_run'
                                    short_description: 'Show Target App only for Manual — App scan mode'
                                }
                            }
                            field: 'target_app'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'ceeb8ab96f4e4551ab979d3f0b29a10e'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'reference_field_list'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'cf26ef2893e540c7ab67a2863512cf78'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'dashboard_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_user_role'
                        id: 'd147bc4fa4e049d59f6b364518b377d6'
                        key: {
                            name: 'x_335329_iscan.scanner'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: 'd1a59a9a63e64cf3a7db93e8e7058c3b'
                        key: {
                            logical_table_name: 'x_335329_iscan_result'
                            col_name_string: 'app'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'd49791440e144caebd4e6a079cbd9a36'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'workflow_count'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'd49e8ed525474bbcad395f7e181a41fd'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'scan_mode'
                            value: 'custom_only'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'd4a4826b05f14b37aff8c08dde520412'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'scan_mode'
                            value: 'manual'
                        }
                    },
                    {
                        table: 'sys_ui_policy_action'
                        id: 'd7307ec2e44549e6b085b5913b9c2c3a'
                        key: {
                            ui_policy: {
                                id: '4ad8abc64a25497194b2b3a0b51a7683'
                                key: {
                                    table: 'x_335329_iscan_run'
                                    short_description: 'Show Target Table only for Manual — Single Table scan mode'
                                }
                            }
                            field: 'target_table'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'd7db94e3075f4fd48111ee2c4a9e7ca9'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'run'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'db3fb32ca05548b2a01046ef32744921'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'data_policy_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'dde67ba2164c438c8cce610408738be7'
                        key: {
                            name: 'x_335329_iscan_crossref'
                            element: 'referencing_scope'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'debdc816cfd847a49ea63212b11124d8'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'target_app'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e0c5c4a9fc554bfab605dd120b8a20ce'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'client_script_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e254e94bcf2c4d48abd709ad3bd55207'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'processor_count'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'e3354282470a0310654c57f1d16d4316'
                        deleted: true
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'manual_app_list'
                            position: '9'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e44813c7261443c2870fab85af4bd04f'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'extends_table'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e4868ab2202d4867a144c413988ddbd8'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'business_rule_count'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: 'e4e4c0af7e7545ac8a6f5232933104cb'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'well_known_base'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: 'e5350e0e47c60310654c57f1d16d432a'
                        key: {
                            list_id: {
                                id: '61350e0e47c60310654c57f1d16d4326'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'started'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'e550674545c444a899d6c1774899edbc'
                        key: {
                            sys_security_acl: '1928fe1021694629a8816518f35ba110'
                            sys_user_role: {
                                id: 'd147bc4fa4e049d59f6b364518b377d6'
                                key: {
                                    name: 'x_335329_iscan.scanner'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'e7354282470a0310654c57f1d16d4313'
                        deleted: true
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'completed'
                            position: '5'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e7ef8ba409434458a2bc854dccc7ac11'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'catalog_variable_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'e8577c2a538c46b2aa2c335a50722109'
                        key: {
                            name: 'x_335329_iscan_table'
                            element: 'well_known_base'
                            value: 'task'
                        }
                    },
                    {
                        table: 'sys_ui_list_element'
                        id: 'e9350e0e47c60310654c57f1d16d4329'
                        key: {
                            list_id: {
                                id: '61350e0e47c60310654c57f1d16d4326'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                    element: 'NULL'
                                    relationship: 'NULL'
                                    parent: 'NULL'
                                }
                            }
                            element: 'completed'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'ea62e3da474ac310654c57f1d16d4382'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'manual_app_list'
                            position: '10'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'eb354282470a0310654c57f1d16d4310'
                        deleted: true
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'scan_mode'
                            position: '1'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ed2c1b6dc22d41bcb7c0723215d75c69'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scan_mode_used'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ed87c7c9117d4aecbee876cbe1896634'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'catalog_variable_count'
                        }
                    },
                    {
                        table: 'sys_index'
                        id: 'edd36d8fdc1b4bc7abe82930b46e2a98'
                        key: {
                            logical_table_name: 'x_335329_iscan_table'
                            col_name_string: 'result'
                        }
                    },
                    {
                        table: 'sys_ui_element'
                        id: 'ee62e3da474ac310654c57f1d16d437f'
                        key: {
                            sys_ui_section: {
                                id: '6b354282470a0310654c57f1d16d4303'
                                key: {
                                    name: 'x_335329_iscan_run'
                                    caption: 'NULL'
                                    view: 'Default view'
                                    sys_domain: 'global'
                                }
                            }
                            element: 'sys_created_by'
                            position: '6'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: 'eef9b62cc4ec4a369854a7d465bc6f5c'
                        key: {
                            name: 'x_335329_iscan_table'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ef719bfdfb9c4f03a5201c51edd2903f'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'pa_indicator_count'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f00b70ad0eb84493bb93a109264c4cae'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'scan_mode'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'f0539e03330a4b54ab61d71e55565563'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'f084096d459d477ea1eb270e6441b213'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'status'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f09e611957c84eceb0d1fe19472cc99f'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'pa_indicator_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f229c0d015d24f5db33f568b537a7c0d'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: 'f58acbc3d88d4ffca1877e4658ba0dc8'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'scan_mode_used'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f62e90328c844d299ff4f7449852e77e'
                        key: {
                            name: 'x_335329_iscan_run'
                            element: 'started'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'f997c2084ab24c2ab32cc1f8f9630655'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'choice_count'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'fa17c2d2cb9d4060970987fce37e0713'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'table_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'fc0be94e33fd46b9a3440c1f614f05a6'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'catalog_item_count'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'fdff96691a0f4d27a327b44be11c81a5'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'flow_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'fe4b18bcb07144a3905617acf628b67b'
                        key: {
                            name: 'x_335329_iscan_result'
                            element: 'transform_map_count'
                            language: 'en'
                        }
                    },
                ]
            }
        }
    }
}
