from flask import Flask, request
import os


g_discovery_apikey  = os.environ[ "DISCOVERY_APIKEY" ]
g_discovery_url     = os.environ[ "DISCOVERY_URL" ]
g_discovery_proj_id = os.environ[ "DISCOVERY_PROJECT_ID" ]

from ibm_watson import DiscoveryV2
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator

g_authenticator = IAMAuthenticator( g_discovery_apikey )
g_discovery = DiscoveryV2( version= "2020-08-30", authenticator=g_authenticator )
g_discovery.set_service_url( g_discovery_url )

import json
import re


def queryDiscovery( parms_json ):

    query    = parms_json["query"]    if "query"    in parms_json else ""
    filter   = parms_json["filter"]   if "filter"   in parms_json else ""
    passages = parms_json["passages"] if "passages" in parms_json else {}
    
    print( "query: " + query )
    print( "filter: " + filter )
    print( "passages: " + json.dumps( passages ) )
    
    response = g_discovery.query( project_id=g_discovery_proj_id, passages=passages, query=query, filter=filter ).get_result()
    #print( json.dumps( response, indent=3 ) )
    
    results_arr = response["results"] if ( "results" in response ) else []
    
    return results_arr


def getUniqueValues( query_results ):
    values_json = { "rooms" : [], "colors" : [] }
    for result in query_results:
        room_name = result["room"]["name"] if ( ( "room" in result ) and ( "name" in result["room"] ) ) else None
        if ( room_name is not None ) and ( room_name not in values_json["rooms"] ):
            values_json["rooms"].append( room_name )
        for widget_type in [ "text_arr", "shape_arr", "sticky_arr" ]:
            if widget_type not in result:
                continue
            if isinstance( result[ widget_type ], list ):
                widget_arr = result[ widget_type ]
                for widget in widget_arr:
                    color = widget["backgroundColor"] if "backgroundColor" in widget else ""
                    color = re.sub( r".*?\|", "", color )
                    color = re.sub( r"__SPLTE__$", "", color )
                    if ( "" != color ) and ( color not in values_json["colors"] ):
                        values_json["colors"].append( color )
            else:
                widget = result[ widget_type ]
                color = widget["backgroundColor"] if "backgroundColor" in widget else ""
                color = re.sub( r".*?\|", "", color )
                color = re.sub( r"__SPLTE__$", "", color )
                if ( "" != color ) and ( color not in values_json["colors"] ):
                    values_json["colors"].append( color )
    return values_json
    

def formatResults( query_results ):
    formatted_results = []
    for result in query_results:
        room_name = result["room"]["name"] if ( ( "room" in result ) and ( "name" in result["room"] ) ) else ""
        workspace_name = result["workspace_name"] if ( "workspace_name" in result ) else ""
        mural_title = result["title"] if ( "title" in result ) else ""
        mural_link = result["link"] if ( "link" in result ) else ""
        mural_thumbnail = result["thumbnail"] if ( "thumbnail" in result ) else ""
        created = result["created"] if ( "created" in result ) else -1
        creator = result["creator"] if ( "creator" in result ) else ""
        formatted_result = { "workspace_name"  : workspace_name,
                             "room_name"       : room_name,
                             "mural_title"     : mural_title,
                             "mural_link"      : mural_link,
                             "mural_thumbnail" : mural_thumbnail,
                             "created"         : created,
                             "creator"         : creator,
                             "passages"        : [] }
        passages = result["document_passages"] if ( "document_passages" in result ) else []
        for passage in passages:
            passage_text = passage["passage_text"] if ( "passage_text" in passage ) else ""
            passage_field = passage["field"] if ( "field" in passage ) else ""
            subpassages = re.findall( r"__SPLTB__.*?__SPLTE__", passage_text )
            for subpassage in subpassages:
                if re.match( r".*\<em>.*", subpassage ):
                    subpassage = re.sub( r"^__SPLTB__", "", subpassage )
                    subpassage = re.sub( r"__SPLTE__$", "", subpassage )
                    parts = subpassage.split( "|", 1 )
                    if ( parts is not None ) and ( len( parts ) > 1 ):
                        widget_id = parts[0]
                        subpassage = parts[1]
                        widget_type = re.sub( r"_arr.*$", "", passage_field )
                        subpassage = "[ " + widget_type + " ] " + subpassage
                        shape = getShape( widget_id, passage_field, result )
                        if shape is not None:
                            subpassage = "[ " + shape + " ] " + subpassage
                        formatted_result["passages"].append( subpassage )
        formatted_results.append( formatted_result )
    return formatted_results


def getShape( widget_id, passage_field, result ):
    field_parts = passage_field.split( "." )
    if ( field_parts is None ) or ( len( field_parts ) < 2 ) or ( "text_arr" == field_parts[0] ):
        return None
    shape = None
    result_arr = result[ field_parts[0] ]
    if isinstance( result_arr, list ):
        for widget in result_arr:
            if widget["id"] == widget_id:
                shape = widget["shape"]
                break
    else:
        widget = result_arr
        if widget["id"] == widget_id:
            shape = widget["shape"]
    if shape is not None:
        shape = re.sub( r"^.*?\|", "", shape )
        shape = re.sub( r"__SPLTE__$", "", shape )
    return shape


app = Flask( __name__, static_url_path="" )

port = int( os.getenv( 'PORT', 8080 ) )


@app.route( "/" )
def root():
    return app.send_static_file( "index.html" )


@app.route( "/uniquevalues" )
def uniquevalues():
    try:
        results_arr = queryDiscovery( {} )
        if ( results_arr is None ) or not isinstance( results_arr, list ) or ( len( results_arr ) < 1 ):
            error_str = "Querying documents in Discovery to get unique values returned no results"
            return { "error_str" : error_str }, 200
        unique_values = getUniqueValues( results_arr )
        return { "unique_values" : unique_values }, 200
    except Exception as e:
        error_str = str( e )
        return { "error_str" : error_str }, 200


@app.route( "/search", methods = ["POST"] )
def search():
    try:
        parms_json = request.json
        results_arr = queryDiscovery( parms_json )
        formatted_results_arr = formatResults( results_arr )
        return { "results_arr" : results_arr, "formatted_results_arr" : formatted_results_arr }, 200
    except Exception as e:
        error_str = str( e )
        return { "error_str" : error_str }, 200


if __name__ == '__main__':
    app.run( host='0.0.0.0', port=port, debug=True)
